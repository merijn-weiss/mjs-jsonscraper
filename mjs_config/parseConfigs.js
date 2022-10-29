'use strict';
const fs = require('fs');
const _ = require('underscore');

// File References
let calBodemFile = 'cal_bodem.json';
let calGreenRoofFile = 'cal_greenroof.json';
let additionalSensorsFile = 'additionalSensors.json';
let deviceSettingsFile = '../config/settings.devices.json';

// Parse the MJS CAL files and create settings.devices.json file as per the format for MJS Scraper
function ParseConfig() {
    let deviceSettings = [];

    // Soil
    let calBodem = JSON.parse(fs.readFileSync(calBodemFile));
    let defaultCalBodem = calBodem.filter((obj) => obj.id === 'default')[0];
    let defaultSoilDevice = ParseCAL('soil', defaultCalBodem);

    for (let device of calBodem){
        if(device.id != 'default')
            deviceSettings.push(ParseCAL('soil', device, defaultSoilDevice));        
    }
    defaultSoilDevice.format.solarV = "4"; // Add this because missing from CAL
    deviceSettings.push(defaultSoilDevice);

    // Greenroof
    let calGreenRoof = JSON.parse(fs.readFileSync(calGreenRoofFile));
    let defaultCalGreenRoof = calGreenRoof.filter((obj) => obj.id === 'default')[0];
    let defaultGreenRoofDevice = ParseCAL('greenroof', defaultCalGreenRoof);

    for (let device of calGreenRoof){
        if(device.id != 'default')
            deviceSettings.push(ParseCAL('greenroof', device, defaultGreenRoofDevice));
    }

    defaultGreenRoofDevice.format.soilM1 = "0"; // Add this because missing from CAL
    defaultGreenRoofDevice.format.soilT1 = "1"; // Add this because missing from CAL
    defaultGreenRoofDevice.format.solarV = "2"; // Add this because missing from CAL
    deviceSettings.push(defaultGreenRoofDevice);

    // Additional sensors
    let additionalSensors = JSON.parse(fs.readFileSync(additionalSensorsFile));
    for (let device of additionalSensors){
        deviceSettings.push(device);
    } 

    // DIRTY FIX, VALUES MISSING FROM CAL
    (deviceSettings.filter((obj) => obj.id === '2021')[0]).format.solarV = "13";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.solarV = "4";

    deviceSettings =  _.sortBy(deviceSettings, 'id');
    console.log(deviceSettings);

    fs.writeFileSync(deviceSettingsFile, JSON.stringify(deviceSettings, null, 2));
}

let fieldMapping = {soilM10: "soilM1", soilT10: "soilT1", soilM40: "soilM2", soilT40: "soilT2"};
let emptyCalibration = {calibration: {soilM1: {a: '', b: ''}, soilT1: {a: '', b: ''}, soilM2: {a: '', b: ''}, soilT2: {a: '', b: ''}}};

function ParseCAL(type, device, defaultDevice) {
    let deviceSetting = {};
    deviceSetting.id = device.id;
    deviceSetting.type = type;

    if(defaultDevice === undefined || !_.isEqual(device.format, defaultDevice.format))
    {
        deviceSetting.format = {};
        for (let field in device.format)
        {
            deviceSetting.format[fieldMapping[field]] = device.format[field];
        }
    }
    
    deviceSetting.calibration = {};
    if(type === 'soil')
    {
        deviceSetting.calibration.soilM1 = {}
        deviceSetting.calibration.soilM1.a = device.calibrations.workshop.values.soilM1.a;
        deviceSetting.calibration.soilM1.b = device.calibrations.workshop.values.soilM1.b;
        
        deviceSetting.calibration.soilT1 = {}
        deviceSetting.calibration.soilT1.a = device.calibrations.workshop.values.soilT1.a;
        deviceSetting.calibration.soilT1.b = device.calibrations.workshop.values.soilT1.b;
        
        deviceSetting.calibration.soilM2 = {}
        deviceSetting.calibration.soilM2.a = device.calibrations.workshop.values.soilM2.a;
        deviceSetting.calibration.soilM2.b = device.calibrations.workshop.values.soilM2.b;
    
        deviceSetting.calibration.soilT2 = {}
        deviceSetting.calibration.soilT2.a = device.calibrations.workshop.values.soilT2.a;
        deviceSetting.calibration.soilT2.b = device.calibrations.workshop.values.soilT2.b;        
    }
    else if(type === 'greenroof')
    {
        deviceSetting.calibration.soilM1 = {}
        deviceSetting.calibration.soilM1.a = device.calibration.soilM.a;
        deviceSetting.calibration.soilM1.b = device.calibration.soilM.b;
        
        deviceSetting.calibration.soilT1 = {}
        deviceSetting.calibration.soilT1.a = device.calibration.soilT.a;
        deviceSetting.calibration.soilT1.b = device.calibration.soilT.b;
    }

    if(defaultDevice != undefined)
    {
        if(_.isEqual(deviceSetting.format, defaultDevice.format))
            delete deviceSetting.format;

        if(_.isEqual(deviceSetting.calibration, defaultDevice.calibration) || _.isEqual(deviceSetting.calibration, emptyCalibration.calibration))
            delete deviceSetting.calibration;
    }

    return deviceSetting;
}


ParseConfig();