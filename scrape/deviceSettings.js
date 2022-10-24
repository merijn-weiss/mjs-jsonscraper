//* Module to get all configuration parameters for all Devices */
'use strict'
require('dotenv').config();

const fs = require('fs');
const config = require('config');
const devicesConfig = config.get('mjsDevices');

// Get Devices
const path = require('path');
const deviceSettingsFile = path.join(__dirname, `../config/${devicesConfig.deviceSettingsFile}`);

let deviceSettings = GetDeviceSettingsFile();
function GetDeviceSettingsFile()
{
    let devices = JSON.parse(fs.readFileSync(deviceSettingsFile));
    return devices;
}

function GetDefaultSettings(deviceType)
{
    let defaultSetting = deviceSettings.filter((obj) => obj.id === 'default' && obj.type === deviceType)[0];
    return defaultSetting;
}

function MergeSettings(devices)
{
    // Add Defaults settings
    for(let device of devices)
    {
        let defaultSetting = GetDefaultSettings(device.type);
        device.format = (device.format === undefined) ? defaultSetting.format : device.format;
        device.calibration = (device.calibration === undefined) ? defaultSetting.calibration : device.calibration;    
    }

    return devices
}

module.exports = {
    allDevices: MergeSettings(GetDeviceSettingsFile().filter((obj) => obj.id != 'default'))
};