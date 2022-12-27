'use strict';
const fs = require('fs');
const _ = require('underscore');

// File References
let mjsNodeFile = 'node_meta_data.json';

let sensorDefaultFile = 'sensorDefaults.json';
let additionalSensorsFile = 'additionalSensors.json';
let deviceSettingsFile = '../config/settings.devices.json';

let typeMapping = {soil_moisture: 'soil', greenroof: 'greenroof', green_roof: 'greenroof', air_quality: 'air', climate: 'base', unknown: 'unknown'};

let sensorTypes = new Set();

// Parse the MJS CAL files and create settings.devices.json file as per the format for MJS Scraper
function ParseConfig() {
    let deviceSettings = [];

    // MJS Nodes
    let mjsDevices = JSON.parse(fs.readFileSync(mjsNodeFile));

    for (let device of mjsDevices.nodes){
        if(device.id != 'default')
        {
            device.maintype = (device.maintype === '') ? 'unknown' : device.maintype;
            deviceSettings.push(ParseCAL(typeMapping[device.maintype], device));
        }
    }

    // Add the defaults to the file
    for (let device of sensorDefault){
        deviceSettings.push(device);
    } 

    // Additional sensors
    let additionalSensors = JSON.parse(fs.readFileSync(additionalSensorsFile));
    for (let device of additionalSensors){
        if(deviceSettings.filter((obj) => obj.id === device.id).length === 0)
        {
            deviceSettings.push(device);
        }
        else
        {
            let deviceToOverwrite = deviceSettings.filter((obj) => obj.id === device.id)[0];

            for(let prop in device)
            {
                deviceToOverwrite[prop] = device[prop];
            }
        }
    }

    console.log('\n**** Sensors in Set ****');
    console.log(sensorTypes);

    // DIRTY FIX, VALUES MISSING /INCORRECT FROM node_meta_data
    (deviceSettings.filter((obj) => obj.id === 'default' && obj.type === 'greenroof')[0]).format.solarV = "2";
    (deviceSettings.filter((obj) => obj.id === 'default' && obj.type === 'soil')[0]).format.solarV = "4";

    deviceSettings =  _.sortBy(deviceSettings, 'id');

    fs.writeFileSync(deviceSettingsFile, JSON.stringify(deviceSettings, null, 2));
}

let callibrationMapping = {soilM1: 'soilM1', soilT1: 'soilT1', soilM2: 'soilM2', soilT2: 'soilT2', roofM: 'roofM', roofT1: 'roofT'};
let sensorDefault = JSON.parse(fs.readFileSync(sensorDefaultFile));
function ParseCAL(type, device) {

    let defaultDevice = sensorDefault.filter((obj) => obj.id === 'default' && obj.type === type)[0];

    let deviceSetting = {};
    deviceSetting.id = device.id;
    deviceSetting.type = type;
    deviceSetting.hardware = device.hardware;
    
    let sensorBase = false;
    let sensorAir = false;
    let sensorGreenroof = false;
    let sensorSoil = false;
    let solarPanel = false;

    if(device.sensors != undefined && device.sensors[0] != undefined && device.sensors[0].order != undefined)
    {
        for(let sensorKey in device.sensors[0].order)
        {
            let sensor = device.sensors[0].order[sensorKey];

            if(!sensorTypes.has(sensor))
                sensorTypes.add(sensor);

            sensorBase = (sensor === 'si7021') ? true : sensorBase;
            sensorAir = (sensor === 'sensirion_sps30') ? true : sensorAir;
            sensorGreenroof = (sensor === '1xpinotechsw10_1xntc10k') ? true : sensorGreenroof;
            sensorSoil = (sensor === '2xpinotechsw10_2xntc10k') ? true : sensorSoil;
            solarPanel = (sensor === 'vsolar') ? true : solarPanel;
        }
    }

    if(deviceSetting.type === 'base')
    {
        if(sensorAir || sensorGreenroof || sensorSoil)
            console.log(`Device Type 'Base', but has ${device.sensors[0].order}`);
    }
    else if(deviceSetting.type === 'unknown')
    {
        console.log(`Device ${deviceSetting.id} type is unknown. Hardware is ${deviceSetting.hardware}`);
    }

    let deviceFormat = {};
    if(device.formats != undefined)
    {
        if(device.formats.length === 1){
            deviceFormat = device.formats[0];

            delete deviceFormat.date;
            delete deviceFormat.sensor;
        }
        else
        {
            console.log(`Enxpected Formats: ${device.id}` )
            console.log(device.formats);
        }    
    }

    if(!_.isEqual(deviceFormat, {}) && !_.isEqual(deviceFormat, defaultDevice.format))
    {
        console.log('Format not default:', deviceFormat);
        console.log('  default:', defaultDevice.format);
        
        deviceSetting.format = {};
        for (let field in deviceFormat)
        {
            deviceSetting.format[field] = deviceFormat[field];
        }
    }
    
    deviceSetting.calibration = {};    
    if(device.calibrations != undefined && device.calibrations[0].values != undefined)
    {
        let calValues = device.calibrations[0].values;

        for(let cal in calValues)
        {
            let mappedCal = callibrationMapping[cal];
            if(mappedCal != undefined && device.calibrations[0].values[cal].a != '' && device.calibrations[0].values[cal].b != '')
            {
                deviceSetting.calibration[mappedCal] = {}
                deviceSetting.calibration[mappedCal].a = device.calibrations[0].values[cal].a;
                deviceSetting.calibration[mappedCal].b = device.calibrations[0].values[cal].b;        
            }
        }
    }

    if(defaultDevice != undefined)
    {
        if(_.isEqual(deviceSetting.format, defaultDevice.format) || _.isEqual(deviceSetting.format, {}))
            delete deviceSetting.format;

        if(_.isEqual(deviceSetting.calibration, defaultDevice.calibration) || _.isEqual(deviceSetting.calibration, {}))
            delete deviceSetting.calibration;
    }

    return deviceSetting;
}

ParseConfig();