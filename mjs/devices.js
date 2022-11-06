//* Module to get all configuration parameters for all Devices */
'use strict'

const {ElasticClient} = require('../util/clientES.js');
const config = require('config');
const {allDevices} = require('./deviceSettings.js');
const elasticConfig = config.get('elastic');

function GetMJSDataUrlDevices(device) {
  let dataURL;
  let currentDate = new Date();
  let lastScrape;
  let lastScrapeLag;

  let lastMeasurement;
  let lastMeasurementLag;
  
  let doScrape = false;

  if(device.lastScrape != undefined) {
    lastScrape = new Date(device.lastScrape);
    lastScrapeLag = Math.round((currentDate.getTime() - lastScrape.getTime())/(1000 * 60)); // see what the difference is in minutes
  }
  
  if(device.lastMeasurement != undefined) {
    lastMeasurement = new Date(device.lastMeasurement);
    lastMeasurementLag = Math.round((currentDate.getTime() - lastMeasurement.getTime())/(1000 * 60)); // see what the difference is in minutes
  }

  let skipCondition = 0;
  // Determine whether or not to scrape the data
  if(lastScrapeLag === undefined)                         // first scrape
  {
    skipCondition = 1;
    doScrape = true;
  }
  else if(lastMeasurement === undefined)                // check once per 24h if a (new) sensor has come online
  {
    skipCondition = 2;
    doScrape = (lastScrapeLag > 24 * 60);
  }
  else if (lastScrapeLag < 30 || lastMeasurement < 30) // very recent scrape, so not again
  {
    skipCondition = 3;
    doScrape = false;
  }
  else
  {
    if(lastMeasurementLag < 24 * 60)                    // sensors seen this day -> try scrape again
    {
      skipCondition = 4;
      doScrape = true;
    }
    else
    {
      skipCondition = 5;
      doScrape = (lastScrapeLag > 24 * 60);             // check once per 24h if a (new) sensor has come online
    }
  }
  
  if (doScrape)
  {
    if(lastMeasurement === undefined)
    {
      dataURL = `https://meetjestad.net/data/?type=sensors&format=json&ids=${device.id}`;
    }
    else
    {
      let nextMeasurement = new Date(lastMeasurement);
      nextMeasurement.setTime(lastMeasurement.getTime() + 60*1000); //Add one minute

      console.log(`${device.id} has data lag of ${lastMeasurementLag} minutes `)
      dataURL = `https://meetjestad.net/data/?type=sensors&format=json&ids=${device.id}&begin=${nextMeasurement.toISOString()}`;  
    }
    return dataURL;
  }
  else
  {
    console.log(`Skip scrape for: ${device.id}. Skip condition: ${skipCondition}`);
    return dataURL;
  }
};

async function GetDevices () {
  const esSearchResult = await ElasticClient.search({
    index: elasticConfig.index.mjs,
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