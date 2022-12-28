'use strict';
const reverseGeo = require('../util/reverseGeo.js');

// JSON CONVERSION
const pmMaxValue = 65000;
async function ConvertRawJSON(source, rawJSON) {
    // DEVICE
    let deviceSettings = JSON.parse(JSON.stringify(rawJSON.device));
    let measurement = rawJSON;
    delete measurement.row;
    delete measurement.device;
    delete measurement.scrapeDataURL;

    let convertedJSON = {};
    convertedJSON.raw = JSON.stringify(measurement);

    // MEASUREMENT
    convertedJSON.timestamp = (new Date(measurement.timestamp + '+0:00')).toISOString(); // MJS raw provides the date in UTC but does not store the timestamp in ISO 8601 

    convertedJSON.device = {};
    convertedJSON.device.source = source;
    convertedJSON.device.id = deviceSettings.id;
    convertedJSON.device.type = deviceSettings.type;
    convertedJSON.device.hardware = deviceSettings.hardware;
    convertedJSON.device.firmware = measurement.firmware_version;

    if(measurement.supply != undefined)
        convertedJSON.device.powerSupply = measurement.supply;
    
    if(measurement.battery != undefined)
        convertedJSON.device.batteryVoltage = measurement.battery;

    if(measurement.extra != undefined && deviceSettings.format.solarV != undefined)
        convertedJSON.device.solarVoltage = measurement.extra[parseInt(deviceSettings.format.solarV)];

    if(measurement.longitude != null && measurement.latitude != null)
    {
        convertedJSON.device.geo = {};
        convertedJSON.device.geo.location = {};
        convertedJSON.device.geo.location.lat = (Math.round(measurement.latitude * 10000))/10000; // round to 11.1 meter precision
        convertedJSON.device.geo.location.lon = (Math.round(measurement.longitude * 10000))/10000; // round to 11.1 meter precision   

        let geoInfo = await reverseGeo.GetGeo(convertedJSON.device.geo.location.lat, convertedJSON.device.geo.location.lon);

        if(geoInfo != undefined)
        {
            for(let geoKey in geoInfo)
            {
                convertedJSON.device.geo[geoKey] = geoInfo[geoKey];
            }
        }
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
    let rawTemperature = rawExtra[parseInt(deviceSettings.format.roofT ) ];
    let aTemp = parseFloat(deviceSettings.calibration.roofT.a);
    let bTemp = parseFloat(deviceSettings.calibration.roofT.b);

    let rawHumidity = rawExtra[parseInt(deviceSettings.format.roofM ) ];
    let aHum = parseFloat(deviceSettings.calibration.roofM.a);
    let bHum = parseFloat(deviceSettings.calibration.roofM.b);

    return {
        temperature: (rawTemperature * aTemp) + bTemp,
        humidity: (rawHumidity * aHum) + bHum,
    }
}

function ConvertSoilValues(deviceSettings, rawExtra) {
    let rawTemperature10 = rawExtra[parseInt(deviceSettings.format.soilT1 ) ];
    let aTemp10 = parseFloat(deviceSettings.calibration.soilT1.a);
    let bTemp10 = parseFloat(deviceSettings.calibration.soilT1.b);

    let rawHumidity10 = rawExtra[parseInt(deviceSettings.format.soilM1 ) ];
    let aHum10 = parseFloat(deviceSettings.calibration.soilM1.a);
    let bHum10 = parseFloat(deviceSettings.calibration.soilM1.b);

    let rawTemperature40 = rawExtra[parseInt(deviceSettings.format.soilT2 ) ];
    let aTemp40 = parseFloat(deviceSettings.calibration.soilT2.a);
    let bTemp40 = parseFloat(deviceSettings.calibration.soilT2.b);

    let rawHumidity40 = rawExtra[parseInt(deviceSettings.format.soilM2 ) ];
    let aHum40 = parseFloat(deviceSettings.calibration.soilM2.a);
    let bHum40 = parseFloat(deviceSettings.calibration.soilM2.b);

    return {
        temperature10: (rawTemperature10 * aTemp10) + bTemp10,
        humidity10: (rawHumidity10 * aHum10) + bHum10,

        temperature40: (rawTemperature40 * aTemp40) + bTemp40,
        humidity40: (rawHumidity40 * aHum40) + bHum40,
    }
}

module.exports = {
    ConvertRawJSON
};