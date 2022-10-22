'use strict';
const axios = require('axios');
const mqtt = require('./clientMQTT.js')

mqtt.MQTTClient();
const topicRaw = mqtt.MQTTTopics.raw.topic;

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

                let measurementIndex = 0;
                const measurementMaxBatchSize = 100;
                let measusrementBatchSize = 0;

                const throttleTimeMS = 500; // We pace publishing the JSON to prevent overloading MQQT
                for(let measurement of measurements) {
                    jsonsPublished++;
                    measusrementBatchSize++;
                    if(measusrementBatchSize = measurementMaxBatchSize)
                    {
                        measurementIndex++;
                        measusrementBatchSize=0;
                    }
                    setTimeout(()=> {
                        console.log(measurement);
                        PublishJSONraw(measurement);  
                    }, measurementIndex * throttleTimeMS);
                }
            })
            .catch(err => {
                console.log('Error: ', err.message);
            })
            .finally(() => {
                resolve([jsonsPublished,`Done with ${device.id}. ${jsonsPublished} JSONs published`]);                
            });
    })
  }

async function PublishJSONraw(rawJSON)
{
  if(mqtt.MQTTClient.client.connected)
    mqtt.MQTTClient.client.publish(topicRaw, JSON.stringify(rawJSON));
}

module.exports = {
    //ScrapeMJS,
    ScrapeMJS: async (devices) => {
        return await ScrapeMJS(devices)
    }
}