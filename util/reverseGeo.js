'use strict'
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const axiosLimited = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 5000});

const fs = require('fs');
const config = require('config');
const geoCacheConfig = config.get('geocache');

const path = require('path');
const geocacheFile = path.join(__dirname, `../config/${geoCacheConfig.geocacheFile}`);

let geoCache;
let apiKey = process.env.GEO_APIKEY;

const GetGeo = async (lat, lon) => {
    if(geoCache === undefined)
        LoadCacheFile();

    let geoKey = `${lat}-${lon}`;
    let cachedGeo = (geoCache.filter((obj) => (obj.geoKey === geoKey)))[0];

    if(cachedGeo === undefined)
    {
        console.log(`GEO API: ${geoKey}`);

        try
        {
            const scrapedGeo = await axiosLimited.get(
                `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&type=amenity&lang=nl&format=json&apiKey=${apiKey}`,
                { timeout: 5000 });
    
            cachedGeo = scrapedGeo.data.results[0];
        }
        catch (error)
        {
            cachedGeo = {}
            cachedGeo.error = error;
        }
        finally
        {
            cachedGeo.geoKey = geoKey;
            geoCache.push(cachedGeo);
            fs.writeFileSync(geocacheFile, JSON.stringify(geoCache, null, 2));
        }
    }
    else
    {
       // console.log(`GEO CACHE: ${geoKey}`);
    }

    if(cachedGeo != undefined && cachedGeo.error === undefined)
    {
        let geoResult = {};
        (cachedGeo.country != undefined)        ? geoResult.country_name = cachedGeo.country : undefined;
        (cachedGeo.country_code != undefined)   ? geoResult.country_iso_code = (cachedGeo.country_code).toUpperCase() : undefined;
        (cachedGeo.state != undefined)          ? geoResult.region_name = cachedGeo.state : undefined;
        (cachedGeo.state_code != undefined)     ? geoResult.region_iso_code = (cachedGeo.state_code).toUpperCase() : undefined;
        (cachedGeo.city != undefined)           ? geoResult.city_name = cachedGeo.city : undefined;
        (cachedGeo.suburb != undefined)         ? geoResult.suburb_name = cachedGeo.suburb : undefined;
        (cachedGeo.street != undefined)         ? geoResult.street_name = cachedGeo.street : undefined;
        (cachedGeo.housenumber != undefined)    ? geoResult.housenumber = cachedGeo.housenumber : undefined;
        (cachedGeo.formatted != undefined)      ? geoResult.name = cachedGeo.formatted : undefined;

        return geoResult;
    }
    else
    {
        return undefined;
    }
};

function LoadCacheFile()
{
    geoCache = JSON.parse(fs.readFileSync(geocacheFile))
}

module.exports = {
    GetGeo
};