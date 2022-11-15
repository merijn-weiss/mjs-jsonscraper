'use strict';
const _ = require('underscore');
const fs = require('fs');
const config = require('config');
const devicesConfig = config.get('mjsDevices');

const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const axiosLimited = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 1000});

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
        device.source = 'MJS';
        if(device.scrapeDataURL != null)
            devicesToScrape.push(device);
    }

    devicesLeftToScrape = devicesToScrape.length;

    const scrapedDevices = [];

    console.log();
    console.log('### Start Scrape ###');

    for(let device of devicesToScrape) {
        let scrapedDevice = await ScrapeDevice(device);
        devicesLeftToScrape = devicesLeftToScrape - 1;

        if(scrapedDevice != undefined)
        {
            for(let measurement of scrapedDevice) {
                if(_.isObject(measurement))
                {
                    measurement.device = device;
                    convertedMeasurements.push(ConvertRawJSON(device.source, measurement));                            
                }
            }
            convertedMeasurementIDs.push(device.id);
            console.log(`${convertedMeasurements.length} measurements buffered for ${convertedMeasurementIDs.length} devices. ${devicesLeftToScrape} devices left to scrape.`)

            if(convertedMeasurements.length > 10000 || devicesLeftToScrape < 5 || convertedMeasurementIDs.length === 50)
            {
                try
                {
                    await StoreConvertedMeasurements(convertedMeasurements);                
                    convertedMeasurements = [];
                    convertedMeasurementIDs = [];                
                }
                catch (error)
                {
                    console.log(error);   
                }
            }

            scrapedDevices.push({deviceID: device.id, measurements: scrapedDevice.length});
        }
        else
        {
            scrapedDevices.push({deviceID: device.id, measurements: undefined});
        }
    }

    console.log('### End Scrape ###')

    return await Promise.allSettled(scrapedDevices);
}

const ScrapeDevice = async device => {
    let measurementCount = 0;
    try {
        console.log();
        console.log(`Scrape ${device.id}`);
        console.log(device.scrapeDataURL);

        const scrapedDevice = await axiosLimited.get(device.scrapeDataURL, { timeout: 5000 });
        measurementCount = scrapedDevice.data.length;

        console.log(`Scraped ${device.id} with ${measurementCount} results`);
        return scrapedDevice.data;    
    }
    catch (error) {
        console.log(`Error for ${device.id}: ${error.message}`);
        return undefined;
    }
}

// ELASTIC
const {ElasticClient} = require('../util/clientES.js');
const elasticConfig = require('config').get('elastic');

ElasticClient.info()
  .then(response => console.log(response))
  .catch(error => console.error(error))

async function StoreConvertedMeasurements(convertedMeasurements)
{
    console.log('Start StoreConvertedMeasurements');
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
        
    console.log('Await result StoreConvertedMeasurements');
    console.log(await b);
    
    console.log(`### Stored ConvertedMeasurements for ${convertedMeasurements.length} measurements. ###`);
    console.log(convertedMeasurementIDs);

    let mjsDevices = JSON.parse(fs.readFileSync(deviceSettingsFile));
    for(let deviceID of convertedMeasurementIDs)
    {
        (mjsDevices.filter((obj) => parseInt(obj.id) === parseInt(deviceID))[0]).lastScrape = new Date();
    }

    fs.writeFileSync(deviceSettingsFile, JSON.stringify(mjsDevices, null, 2));
}

module.exports = {
    //ScrapeMJS,
    ScrapeMJS: async (devices) => {
        return await ScrapeMJS(devices)
    }
}