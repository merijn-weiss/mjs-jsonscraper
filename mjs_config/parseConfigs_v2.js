'use strict';
const fs = require('fs');
const _ = require('underscore');

// File References
let mjsNodeFile = 'node_meta_data_v2.json';

let sensorDefaultFile = 'sensorDefaults.json';
let additionalSensorsFile = 'additionalSensors.json';

let deviceSettingsFile = '../config/settings.devices.json';

let typeMapping = {soil_moisture: 'soil', green_roof: 'greenroof', air_quality: 'air', climate: 'base', unknown: 'unknown'};

// Parse the MJS CAL files and create settings.devices.json file as per the format for MJS Scraper
function ParseConfig() {
    let deviceSettings = [];

    // MJS Nodes
    let mjsDevices = JSON.parse(fs.readFileSync(mjsNodeFile));
    
    for (let device of mjsDevices){
        if(device.id != 'default')
            deviceSettings.push(ParseCAL(typeMapping[device.type], device));        
    }

    // Add the defaults to the file
    for (let device of sensorDefault){
        deviceSettings.push(device);
    } 

    // Additional sensors
    let additionalSensors = JSON.parse(fs.readFileSync(additionalSensorsFile));
    for (let device of additionalSensors){
        if(deviceSettings.filter((obj) => obj.id === device.id).length === 0)
            deviceSettings.push(device);            
    } 

    // DIRTY FIX, VALUES MISSING /INCORRECT FROM node_meta_data
    (deviceSettings.filter((obj) => obj.id === 'default' && obj.type === 'greenroof')[0]).format.solarV = "2";
    (deviceSettings.filter((obj) => obj.id === 'default' && obj.type === 'soil')[0]).format.solarV = "4";

    (deviceSettings.filter((obj) => obj.id === '2021')[0]).format.solarV = "13";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.soilM1 = "2";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.soilT1 = "1";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.soilM2 = "0";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.soilT2 = "3";
    (deviceSettings.filter((obj) => obj.id === '2059')[0]).format.solarV = "4";

    delete (deviceSettings.filter((obj) => obj.id === '0'));

    deviceSettings =  _.sortBy(deviceSettings, 'id');

    fs.writeFileSync(deviceSettingsFile, JSON.stringify(deviceSettings, null, 2));
}

let emptyCalibration = {calibration: {soilM1: {a: '', b: ''}, soilT1: {a: '', b: ''}, soilM2: {a: '', b: ''}, soilT2: {a: '', b: ''}}};

let sensorDefault = JSON.parse(fs.readFileSync(sensorDefaultFile));
function ParseCAL(type, device) {

    let defaultDevice = sensorDefault.filter((obj) => obj.id === 'default' && obj.type === type)[0];

    let deviceSetting = {};
    deviceSetting.id = device.id;
    deviceSetting.type = type;

    let deviceFormat = {};
    if(device.format != undefined && device.format.length > 1)
    {
        deviceFormat = device.format[1];

        delete deviceFormat.sensor;
    }
    console.log(deviceSetting.id, deviceFormat);
    if(!_.isEqual(deviceFormat, {}) && !_.isEqual(device.format, defaultDevice.format))
    {
        deviceSetting.format = {};
        for (let field in deviceFormat)
        {
            deviceSetting.format[field] = deviceFormat[field];
        }
    }
    
    deviceSetting.calibration = {};
    if(device.calibrations != undefined && device.calibrations.workshop != undefined && device.calibrations.workshop.values != undefined)
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

    if(defaultDevice != undefined)
    {
        if(_.isEqual(deviceSetting.format, defaultDevice.format) || _.isEqual(deviceSetting.format, {}))
            delete deviceSetting.format;

        if(_.isEqual(deviceSetting.calibration, defaultDevice.calibration) || _.isEqual(deviceSetting.calibration, emptyCalibration.calibration) || _.isEqual(deviceSetting.calibration, {}))
            delete deviceSetting.calibration;
    }

    return deviceSetting;
}


ParseConfig();