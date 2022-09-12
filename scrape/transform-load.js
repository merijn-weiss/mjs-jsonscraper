'use strict';
const path = require('path');

//MQTT
const mqtt = require('./clientMQTT.js')
mqtt.MQTTClient();
mqtt.SubscribeOnTopics(['raw','converted']);

const topicRaw = mqtt.MQTTTopics.raw.topic;
const topicConverted = mqtt.MQTTTopics.converted.topic;

mqtt.MQTTClient.client.on('message', function(topic, message) {
    try{
        let jsonMessage = JSON.parse(message);

        if(topic === topicRaw)
        {
            let convertedJSON = ConvertRawJSON(jsonMessage);
            if(mqtt.MQTTClient.client.connected)
                mqtt.MQTTClient.client.publish(topicConverted, JSON.stringify(convertedJSON));
        }
        else if(topic === topicConverted)
        {
            StoreJSONonElastic(jsonMessage);
        }
    }
    catch (err)
    {
        console.log("Error parsing JSON message:", err);
    }
  });


// JSON CONVERSION
const pmMaxValue = 65000;
function ConvertRawJSON(rawJSON) {
    console.log(rawJSON);

    let convertedJSON = {};

    delete rawJSON.row;
    convertedJSON.raw = JSON.stringify(rawJSON);

    // MEASUREMENT
    convertedJSON.timestamp = (new Date(rawJSON.timestamp + '+0:00')).toISOString(); // MJS raw provides the date in UTC but does not store the timestamp in ISO 8601 

    // DEVICE
    let deviceSettings = GetDeviceSettings(rawJSON.id);
    console.log(deviceSettings);

    convertedJSON.device = {};
    convertedJSON.device.id = deviceSettings.deviceID;
    convertedJSON.device.type = deviceSettings.device.type;
    convertedJSON.device.firmware = rawJSON.firmware_version;

    if(rawJSON.extra != undefined && (deviceSettings.device.format || deviceSettings.default.format).solarV != undefined)
        convertedJSON.device.solarVoltage = rawJSON.extra[parseInt((deviceSettings.device.format || deviceSettings.default.format).solarV)];

    if(rawJSON.longitude != null && rawJSON.latitude != null)
    {
        convertedJSON.device.location = {};
        convertedJSON.device.location.lon = rawJSON.longitude;    
        convertedJSON.device.location.lat = rawJSON.latitude;    
    }
    
    // SENSORS
    convertedJSON.sensors = {};

    convertedJSON.sensors.base = {};
    convertedJSON.sensors.base.temperature = rawJSON.temperature;
    convertedJSON.sensors.base.humidity = rawJSON.humidity;

    let pm2_5 = (rawJSON['pm2.5'] = undefined ? undefined : rawJSON['pm2.5'] > pmMaxValue ? undefined : rawJSON['pm2.5']);
    let pm10 = (rawJSON.pm10 = undefined ? undefined : rawJSON.pm10 > pmMaxValue ? undefined : rawJSON.pm10);

    if( pm2_5 != undefined || pm10 != undefined)
    {
        console.log(pm2_5, rawJSON['pm2.5']);
        console.log(pm2_5, rawJSON.pm10);
        convertedJSON.sensors.airquality = {};
        convertedJSON.sensors.airquality.pm2_5 = pm2_5;
        convertedJSON.sensors.airquality.pm10 = pm10;
    }

    if(rawJSON.extra != undefined && convertedJSON.device.type === 'greenroof')
    {
        convertedJSON.sensors.greenroof = {};
        let greenRoofValues = ConvertGreenRoofValues(deviceSettings, rawJSON.extra);
        convertedJSON.sensors.greenroof.temperature = greenRoofValues.temperature;
        convertedJSON.sensors.greenroof.humidity = greenRoofValues.humidity;
    }

    return convertedJSON;
}

function ConvertGreenRoofValues(deviceSettings, rawExtra) {
    let defaultSetting = deviceSettings.default;
    let deviceSetting = deviceSettings.device;

    let rawTemperature = rawExtra[parseInt( (deviceSetting.format || defaultSetting.format).soilT ) ];
    let aTemp = parseFloat((deviceSetting.calibration || defaultSetting.calibration).soilT.a);
    let bTemp = parseFloat((deviceSetting.calibration || defaultSetting.calibration).soilT.b);

    let rawHumidity = rawExtra[parseInt( (deviceSetting.format || defaultSetting.format).soilM ) ];
    let aHum = parseFloat((deviceSetting.calibration || defaultSetting.calibration).soilM.a);
    let bHum = parseFloat((deviceSetting.calibration || defaultSetting.calibration).soilM.b);

    return {
        temperature: (rawTemperature * aTemp) + bTemp,
        humidity: (rawHumidity * aHum) + bHum,
    }
}

const deviceSettingsFile = path.join(__dirname, '../config/settings.devices.json');
function GetDeviceSettings(deviceID)
{
    let deviceSettings = require(deviceSettingsFile);

    let deviceSetting = deviceSettings.filter((obj) => obj.id === deviceID.toString())[0];

    let defaultSetting = deviceSettings.filter((obj) => obj.id === 'default' && obj.type === deviceSetting.type)[0];

    return {
        deviceID : deviceID,
        default: defaultSetting,
        device: (deviceSetting || defaultSetting)
    }   
}

// ELASTIC
const {ElasticClient} = require('./clientES.js');
const elasticConfig = require('config').get('elastic');

ElasticClient.info()
  .then(response => console.log(response))
  .catch(error => console.error(error))

async function StoreJSONonElastic(convertedJSON)
{
    console.log(convertedJSON);

    await ElasticClient.index({
        index: elasticConfig.index,
        body: convertedJSON
        });

    await ElasticClient.indices.refresh({index: elasticConfig.index});
}