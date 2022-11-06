require('dotenv').config();
const devices = require('./devices.js');
const extract = require('./extractAndStore.js');

const defaultWait = 300*1000; // 5 minutes

const scrapeDevices = async () => {
    try {
        const allDevices = await devices.AllDevices();
        const scrapedDevices = await extract.ScrapeMJS(allDevices);

        console.log(scrapedDevices);
        let totalJSON = 0;
        for(let deviceStatus of scrapedDevices)
        {
            totalJSON = deviceStatus[0] + totalJSON;
        }

        let scrapeSleepTime = defaultWait;

        console.log(`***** Scrape Completed. Start Sleep for ${Math.round(scrapeSleepTime/1000)} seconds *****`);
        setTimeout(scrapeDevices, scrapeSleepTime);
    } catch (error) {
        console.error(error);
        setTimeout(scrapeDevices, defaultWait); // restart after an error the cycle. E.g. to recover from a network failure.
    }
  }

scrapeDevices();