const devices = require('./devices.js');
//const extract = require('./extract.js');
const extract = require('./extractAndStore.js');

const defaultWait = 300*1000; // 5 minutes
function ScrapeDevices()
{
    devices.AllDevices()
        .then((result) => {
            console.log('***** Scrape Started. *****');
            extract.ScrapeMJS(result)
                .then((status) => {
                    console.log(status);
                    let totalJSON = 0;
                    for(let deviceStatus of status)
                    {
                        totalJSON = deviceStatus[0] + totalJSON;
                    }
                    let scrapeSleepTime = defaultWait;//+ (totalJSON * 100); // for each JSON we wait for 0.1 second

                    console.log(`***** Scrape Completed. Start Sleep for ${Math.round(scrapeSleepTime/1000)} seconds *****`);
                    setTimeout(ScrapeDevices, scrapeSleepTime);        
                });
        })
        .catch((err) => {
            console.error(err);
            setTimeout(ScrapeDevices, defaultWait); // restart after an error the cycle. E.g. to recover from a network failure.
        }
        )
}

ScrapeDevices();