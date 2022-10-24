//* Module to get all configuration parameters for all Devices */

'use strict'
require('dotenv').config();

const {ElasticClient} = require('./clientES.js');
const config = require('config');
const {allDevices} = require('./deviceSettings.js');
const elasticConfig = config.get('elastic');

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
  
  // Get Devices from ES to get last results stored
  const esDevices = esSearchResult.aggregations.devices.buckets;

  for(let device of allDevices)
  {
    let esDevice = esDevices.filter((obj) => obj.key === parseInt(device.id));
    
    if(esDevice.length != 0)
      device.lastMeasurement = esDevice[0].max_timestamp.value_as_string;
    
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