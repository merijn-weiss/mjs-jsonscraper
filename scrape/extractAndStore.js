'use strict';
require('dotenv').config();

const axios = require('axios');
const {ConvertRawJSON} = require('./transform.js');

async function ScrapeMJS(devices)
{
    return new Promise(async (resolve) => {
        let devicesToScrape = [];
        for(let device of devices) {
            if(device.scrapeDataURL != null)
                devicesToScrape.push(device);
        }

        const status = await Promise.all(devicesToScrape.map(device => scrapeAndPublish(device)))
        resolve(status);
    });
}

const scrapeAndPublish = device => {
    return new Promise(async (resolve) => {
        let jsonsPublished = 0;
        
        axios.get(device.scrapeDataURL)
            .then(res => {
                console.log(device.scrapeDataURL);
                const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
                console.log('Status Code:', res.status);
                console.log('Date in Response header:', headerDate);

                const measurements = res.data;
                let convertedMeasurements = [];
                for(let measurement of measurements) {
                    measurement.device = device;
                    convertedMeasurements.push(ConvertRawJSON(measurement));
                }

                StoreConvertedMeasurements(convertedMeasurements);
                jsonsPublished = convertedMeasurements.length;
            })
            .catch(err => {
                console.log('Error: ', err.message);
            })
            .finally(() => {
                resolve([jsonsPublished,`Done with ${device.id}. ${jsonsPublished} JSONs published`]);                
            });
    })
  }

// ELASTIC
const {ElasticClient} = require('./clientES.js');
const elasticConfig = require('config').get('elastic');

ElasticClient.info()
  .then(response => console.log(response))
  .catch(error => console.error(error))

async function StoreConvertedMeasurements(convertedMeasurements)
{
    console.log(convertedMeasurements);

    const b = ElasticClient.helpers.bulk({
        datasource: convertedMeasurements,
        onDocument (doc) {
          return {
            index: { _index: elasticConfig.index }
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