'use strict';
require('dotenv').config();

const axios = require('axios');

async function ScrapeKNMI()
{
    return new Promise(async (resolve) => {
        scrapeAndPublish();
    });
}

let stationID = 260;
let startDate = '2022090100';
let endDate = '2022102800';

const scrapeAndPublish = () => {
    return new Promise(async (resolve) => {
        let jsonsPublished = 0;
        let scrapeDataURL = `https://www.daggegevens.knmi.nl/klimatologie/uurgegevens?stns=${stationID}&fmt=json&vars=ALL&start=${startDate}&end=${endDate}`;

        axios.get(scrapeDataURL)
            .then(res => {
                console.log(scrapeDataURL);
                const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
                console.log('Status Code:', res.status);
                console.log('Date in Response header:', headerDate);

                const measurements = res.data;
                let convertedMeasurements = [];
                
                for(let measurement of measurements) {
                    
                    measurement.T = measurement.T / 10;

                    measurement.RH = (measurement.RH === -1) ? 0.005 : measurement.RH/10;

                    const measurementDate = new Date(measurement.date);
                    measurementDate.setTime(measurementDate.getTime() + measurement.hour * 60 * 60 * 1000);
                    measurement.timestamp = measurementDate.toJSON();

                    delete measurement.date;
                    delete measurement.hour;


                    convertedMeasurements.push(measurement);
                }

                console.log(convertedMeasurements);

                if(convertedMeasurements.length > 0)
                    StoreConvertedMeasurements(convertedMeasurements);
                    
                jsonsPublished = convertedMeasurements.length;
            })
            .catch(err => {
                console.log('Error: ', err.message);
            })
            .finally(() => {
                resolve([jsonsPublished,`Done with KNMI Scrape. ${jsonsPublished} JSONs published`]);                
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
    console.log(elasticConfig.index.knmi);

    const b = ElasticClient.helpers.bulk({
        datasource: convertedMeasurements,
        onDocument (doc) {
          return {
            index: { _index: elasticConfig.index.knmi }
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
    ScrapeKNMI: async () => {
        return await ScrapeKNMI()
    }
}