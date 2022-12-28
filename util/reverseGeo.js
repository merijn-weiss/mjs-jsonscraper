'use strict'
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const axiosLimited = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 5000});

const fs = require('fs');
const config = require('config');
const geoCacheConfig = config.get('geocache');

const haversine = require('haversine-distance')

const path = require('path');
const geocacheFile = path.join(__dirname, `../config/${geoCacheConfig.geocacheFile}`);

let geoCache;
let apiKey = process.env.GEO_APIKEY;

const GetGeo = async (id, lat, lon) => {
    if(geoCache === undefined)
        LoadCacheFile();

    // see if there is a known location for the device
    let deviceGeo = geoCache.devices[id];

    let pinnedGeo;
    if(deviceGeo != undefined && deviceGeo.pinnedGeo != undefined)
        pinnedGeo = { latitude: deviceGeo.pinnedGeo.lat, longitude: deviceGeo.pinnedGeo.lon };
 
    let newGeo = (lat > 0 && lon > 0) ? { latitude: lat, longitude: lon } : undefined;

    if(pinnedGeo != undefined && newGeo != undefined)
    {
        let distanceToPin = haversine(newGeo, pinnedGeo);
        if(distanceToPin < 100) // when the geo distance is less then 100 meters from the pinnend then use the pinned geo
        {
            lat = pinnedGeo.latitude;
            lon = pinnedGeo.longitude;
        }    
    }

    let geoKey = `${lat}-${lon}`;
    let cachedGeo = geoCache.locations[geoKey];

    if(cachedGeo === undefined)
    {
        console.log(`GEO API: ${geoKey}`);

        try
        {
            const scrapedGeo = await axiosLimited.get(
                `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&type=amenity&lang=nl&format=json&apiKey=${apiKey}`,
                { timeout: 10000 });
    
            cachedGeo = scrapedGeo.data.results[0];
        }
        catch (error)
        {
            cachedGeo = {}
            cachedGeo.error = error;

            console.log(error);
        }
        finally
        {
            if(cachedGeo != undefined)
            {
                cachedGeo.geoKey = geoKey;

                geoCache.devices[id] = {pinnedGeo : {lat: lat, lon: lon} };
                geoCache.locations[geoKey] = cachedGeo;
                
                fs.writeFileSync(geocacheFile, JSON.stringify(geoCache, null, 2));    
            }
            else
            {
                console.log(`undefined cachedGeo for ${geoKey}`);
            }
        }
    }

    if(cachedGeo != undefined && cachedGeo.error === undefined)
    {
        let geoResult = {};
        geoResult.lat = lat;
        geoResult.lon = lon;
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