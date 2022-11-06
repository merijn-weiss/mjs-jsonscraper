'use strict';
const _ = require('underscore');
const fs = require('fs');
const config = require('config');
const devicesConfig = config.get('mjsDevices');

const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const axiosRateLimited = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 5000})

const {ConvertRawJSON} = require('./transform.js');

const path = require('path');
const deviceSettingsFile = path.join(__dirname, `../config/${devicesConfig.deviceSettingsFile}`);

let convertedMeasurements = [];
let convertedMeasurementIDs = [];
let devicesLeftToScrape = 0;

async function ScrapeMJS(devices)
{
    let devicesToScrape = [];

    for(let device of devices) {
        if(device.scrapeDataURL != null)
            devicesToScrape.push(device);
    }

    devicesLeftToScrape = devicesToScrape.length;
    return await Promise.allSettled(devicesToScrape.map(device => scrapeAndPublish(device)))
}

const scrapeAndPublish = device => {
    return new Promise((resolve, reject) => {
        let jsonsPublished = 0;
        
        axiosRateLimited.get(device.scrapeDataURL, { timeout: 5000 })
            .then(res => {
                convertedMeasurementIDs.push(device.id);

                console.log();
                console.log(device.scrapeDataURL);
                //const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
                //console.log('Status Code:', res.status);
                //console.log('Date in Response header:', headerDate);

                const measurements = res.data;
                
                for(let measurement of measurements) {
                    if(_.isObject(measurement))
                    {
                        measurement.device = device;
                        convertedMeasurements.push(ConvertRawJSON(measurement));    
                    }
                    else {
                        console.log(measurements);
                    }
                }

                if(convertedMeasurements.length > 100000 || devicesLeftToScrape < 5 || convertedMeasurementIDs.length === 50)
                {
                    StoreConvertedMeasurements(convertedMeasurements);

                    let mjsDevices = JSON.parse(fs.readFileSync(deviceSettingsFile));
                    for(let deviceID of convertedMeasurementIDs)
                    {
                        console.log(deviceID);
                        (mjsDevices.filter((obj) => obj.id === deviceID)[0]).lastScrape = new Date();    
                    }
                
                    fs.writeFileSync(deviceSettingsFile, JSON.stringify(mjsDevices, null, 2));

                    convertedMeasurements = [];
                    convertedMeasurementIDs = [];
                }
                console.log(`${convertedMeasurements.length} measurements buffered for ${convertedMeasurementIDs.length} devices. ${devicesLeftToScrape} devices left to scrape.`)
                jsonsPublished = convertedMeasurements.length;
            })
            .catch(err => {
                console.log();
                console.log(device.scrapeDataURL);
                reject(console.log(`Error for ${device.id}: ${err.message}`));
            })
            .finally(() => {
                devicesLeftToScrape = devicesLeftToScrape - 1;
                resolve([jsonsPublished,`Done with ${device.id}. ${jsonsPublished} JSONs published`]);                
            });
    })
  }

// ELASTIC
const {ElasticClient} = require('../util/clientES.js');
const elasticConfig = require('config').get('elastic');

ElasticClient.info()
  .then(response => console.log(response))
  .catch(error => console.error(error))

async function StoreConvertedMeasurements(convertedMeasurements)
{
    //console.log(convertedMeasurements);

    const b = ElasticClient.helpers.bulk({
        datasource: convertedMeasurements,
        onDocument (doc) {
          return {
            index: { _index: elasticConfig.index.mjs }
          }
        },
        onDrop (doc) {
          b.abort()
        }
      })
      
    console.log(await b)
}

module.exports = {
    //ScrapeMJS,
    ScrapeMJS: async (devices) => {
        return await ScrapeMJS(devices)
    }
}