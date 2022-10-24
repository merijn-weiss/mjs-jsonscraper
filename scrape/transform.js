'use strict';

// JSON CONVERSION
const pmMaxValue = 65000;
function ConvertRawJSON(rawJSON) {
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
    convertedJSON.device.id = deviceSettings.id;
    convertedJSON.device.type = deviceSettings.type;
    convertedJSON.device.firmware = measurement.firmware_version;

    if(measurement.supply != undefined)
        convertedJSON.device.powerSupply = measurement.supply;
    
    if(measurement.battery != undefined)
        convertedJSON.device.batteryVoltage = measurement.battery;

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

module.exports = {
    ConvertRawJSON
};