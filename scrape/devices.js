//* Module to get all configuration parameters for all Devices */

'use strict'
const {ElasticClient} = require('./clientES.js');
const fs = require('fs');
const config = require('config');
const devicesConfig = config.get('mjsDevices');
const elasticConfig = config.get('elastic');

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

function GetMJSDataUrlDevices(device) {
  let dataURL;
  if(device.lastMeasurement === undefined)
  {
    dataURL = `https://meetjestad.net/data/?type=sensors&format=json&ids=${device.id}`;
  }
  else
  {
    let currentDate = new Date();
    let nextMeasurement = new Date(device.lastMeasurement);
    nextMeasurement.setTime(nextMeasurement.getTime() + 60*1000); //Add one minute

    let timeDifference = Math.round((currentDate.getTime() - nextMeasurement.getTime())/(1000 * 60)); // see what the difference is in minutes

    if(timeDifference > 15)
    {
      console.log(`${device.id} has data lag of ${timeDifference} minutes `)
    
      dataURL = `https://meetjestad.net/data/?type=sensors&format=json&ids=${device.id}&begin=${nextMeasurement.toISOString()}`;  
    }
  }
  return dataURL;
};

async function GetDevices () {
  const esSearchResult = await ElasticClient.search({
    index: elasticConfig.index,
    aggs:
    {
        devices :
        {
            terms:{field: 'device.id',size: 10000},
            aggs: {max_timestamp: { max: { field: 'timestamp' } }}    
        }
    }    
  })
  
  // Get Devices from the JSON
  const allDevices = GetDeviceSettingsFile().filter((obj) => obj.id != 'default');

  // Get Devices from ES to get last results stored
  const esDevices = esSearchResult.aggregations.devices.buckets;

  for(let device of allDevices)
  {
    let esDevice = esDevices.filter((obj) => obj.key === parseInt(device.id));
    
    if(esDevice.length != 0)
      device.lastMeasurement = esDevice[0].max_timestamp.value_as_string;
    
    // Add Defaults settings
    let defaultSetting = GetDefaultSettings(device.type);
    device.format = (device.format === undefined) ? defaultSetting.format : device.format;
    device.calibration = (device.calibration === undefined) ? defaultSetting.calibration : device.calibration;

    // Add MJS DataURL
    device.scrapeDataURL = GetMJSDataUrlDevices(device);
  }

  return allDevices;
}

module.exports = {
  AllDevices: async () => {
    let theDevices = await GetDevices()
    return theDevices
  }
}