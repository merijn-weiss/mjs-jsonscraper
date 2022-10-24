'use strict';
require('dotenv').config();

//MQTT
const mqtt = require('./clientMQTT.js')
mqtt.MQTTClient();
mqtt.SubscribeOnTopics(['raw','converted']);

const topicRaw = mqtt.MQTTTopics.raw.topic;
const topicConverted = mqtt.MQTTTopics.converted.topic;

mqtt.MQTTClient.client.on('message', function(topic, message) {
    try{
        let jsonMessage = JSON.parse(message);
        let skipMQTT = true; 

        if(topic === topicRaw)
        {
            let convertedJSON = ConvertRawJSON(jsonMessage);

            if(skipMQTT) // store directly on ES, skipping one MQTT message
            {
                StoreJSONonElastic(convertedJSON);
            }
            else
            {
                if(mqtt.MQTTClient.client.connected)
                    mqtt.MQTTClient.client.publish(topicConverted, JSON.stringify(convertedJSON));
            }
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
    let measurement = rawJSON.measurement;
    let convertedJSON = {};

    delete measurement.row;
    convertedJSON.raw = JSON.stringify(measurement);

    // MEASUREMENT
    convertedJSON.timestamp = (new Date(measurement.timestamp + '+0:00')).toISOString(); // MJS raw provides the date in UTC but does not store the timestamp in ISO 8601 

    // DEVICE
    let deviceSettings = rawJSON;//GetDeviceSettings(rawJSON.id);

    convertedJSON.device = {};
    convertedJSON.device.id = deviceSettings.id;
    convertedJSON.device.type = deviceSettings.type;
    convertedJSON.device.firmware = measurement.firmware_version;

    if(measurement.extra != undefined && deviceSettings.format.solarV != undefined)
        convertedJSON.device.solarVoltage = measurement.extra[parseInt(deviceSettings.format.solarV)];

    if(measurement.longitude != null && measurement.latitude != null)
    {
        convertedJSON.device.location = {};
        convertedJSON.device.location.lon = measurement.longitude;    
        convertedJSON.device.location.lat = measurement.latitude;    
    }
    
    // SENSORS
    convertedJSON.sensors = {};

    convertedJSON.sensors.base = {};
    convertedJSON.sensors.base.temperature = measurement.temperature;
    convertedJSON.sensors.base.humidity = measurement.humidity;

    let pm2_5 = (measurement['pm2.5'] = undefined ? undefined : measurement['pm2.5'] > pmMaxValue ? undefined : measurement['pm2.5']);
    let pm10 = (measurement.pm10 = undefined ? undefined : measurement.pm10 > pmMaxValue ? undefined : measurement.pm10);

    if( pm2_5 != undefined || pm10 != undefined)
    {
        convertedJSON.sensors.airquality = {};
        convertedJSON.sensors.airquality.pm2_5 = pm2_5;
        convertedJSON.sensors.airquality.pm10 = pm10;
    }

    if(measurement.extra != undefined && convertedJSON.device.type === 'greenroof')
    {
        convertedJSON.sensors.greenroof = {};
        let greenRoofValues = ConvertGreenRoofValues(deviceSettings, measurement.extra);
        convertedJSON.sensors.greenroof.temperature = greenRoofValues.temperature;
        convertedJSON.sensors.greenroof.humidity = greenRoofValues.humidity;
    }

    if(measurement.extra != undefined && convertedJSON.device.type === 'soil')
    {
        convertedJSON.sensors.soil = {};
        let soilValues = ConvertSoilValues(deviceSettings, measurement.extra);
        convertedJSON.sensors.soil.temperature_D10 = soilValues.temperature10;
        convertedJSON.sensors.soil.humidity_D10 = soilValues.humidity10;
        convertedJSON.sensors.soil.temperature_D40 = soilValues.temperature40;
        convertedJSON.sensors.soil.humidity_D40 = soilValues.humidity40;
    }

    return convertedJSON;
}

function ConvertGreenRoofValues(deviceSettings, rawExtra) {
    let rawTemperature = rawExtra[parseInt(deviceSettings.format.soilT ) ];
    let aTemp = parseFloat(deviceSettings.calibration.soilT.a);
    let bTemp = parseFloat(deviceSettings.calibration.soilT.b);

    let rawHumidity = rawExtra[parseInt(deviceSettings.format.soilM ) ];
    let aHum = parseFloat(deviceSettings.calibration.soilM.a);
    let bHum = parseFloat(deviceSettings.calibration.soilM.b);

    return {
        temperature: (rawTemperature * aTemp) + bTemp,
        humidity: (rawHumidity * aHum) + bHum,
    }
}

function ConvertSoilValues(deviceSettings, rawExtra) {
    let rawTemperature10 = rawExtra[parseInt(deviceSettings.format.soil10T ) ];
    let aTemp10 = parseFloat(deviceSettings.calibration.soil10T.a);
    let bTemp10 = parseFloat(deviceSettings.calibration.soil10T.b);

    let rawHumidity10 = rawExtra[parseInt(deviceSettings.format.soil10M ) ];
    let aHum10 = parseFloat(deviceSettings.calibration.soil10M.a);
    let bHum10 = parseFloat(deviceSettings.calibration.soil10M.b);

    let rawTemperature40 = rawExtra[parseInt(deviceSettings.format.soil40T ) ];
    let aTemp40 = parseFloat(deviceSettings.calibration.soil40T.a);
    let bTemp40 = parseFloat(deviceSettings.calibration.soil40T.b);

    let rawHumidity40 = rawExtra[parseInt(deviceSettings.format.soil40M ) ];
    let aHum40 = parseFloat(deviceSettings.calibration.soil40M.a);
    let bHum40 = parseFloat(deviceSettings.calibration.soil40M.b);

    return {
        temperature10: (rawTemperature10 * aTemp10) + bTemp10,
        humidity10: (rawHumidity10 * aHum10) + bHum10,

        temperature40: (rawTemperature40 * aTemp40) + bTemp40,
        humidity40: (rawHumidity40 * aHum40) + bHum40,
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
}