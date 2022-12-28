'use strict';

const axios = require('axios');
const rateLimit = require('axios-rate-limit');

// sets max 2 requests per 1 second, other will be delayed
const http = rateLimit(axios.create(), { maxRequests: 50, perMilliseconds: 1000})
let knownSensors = [];
console.log(knownSensors);

const getJSON = function (id) {
    http({
        method: "GET",
        url: `https://meetjestad.net/data/?type=sensors&ids=${id}&format=json&limit=1`,
      }).then(function (response) {

        if(response.data.length > 0 && response.data[0].id === id)
        {
            let deviceJSON = response.data[0];

            let hasExtra = (deviceJSON.extra !== undefined);
            let hasPM = (deviceJSON.pm10 !== undefined);

            let device = {};
            device.id = deviceJSON.id;

            if(hasExtra) {
                if(deviceJSON.extra.length === 3)
                {
                    device.type = 'greenroof';
                    console.log(`${deviceJSON.id} -> Greenroof: ${deviceJSON.extra}`);
                }
                else if(deviceJSON.extra.length === 5)
                {
                    device.type = 'soil';
                    console.log(`${deviceJSON.id} -> Soil: ${deviceJSON.extra}`);
                }
                else
                {
                    device.type = 'other';
                    console.log(`${deviceJSON.id} -> Other: ${deviceJSON.extra}`);
                }
            }
            else if(hasPM) {
                device.type = 'air';
                console.log(`${deviceJSON.id} -> Air: ${deviceJSON.pm10}`);
            }
            else{
                device.type = 'base';
                console.log(`${deviceJSON.id} -> Base`);
            }
            
            knownSensors.push(device);
        }
        
      });    
}

for (let id = 0; id < 100; id++) {
    let device = getJSON(id);
}

//for (let id = 1000; id < 2200; id++) {
//    let device = getJSON(id);
//}

console.log(knownSensors);