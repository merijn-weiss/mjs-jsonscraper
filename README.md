# mjs-jsonscraper
Experimental application to extra data from MJS, parse the data into a common format and store the results into Elastic. 

To run the application you need to create a .env file in the root folder with the following keys to configure access to a Elastic Cloud instance:

    ES_CLOUDID=
    ES_USERNAME=
    ES_PASSWORD=

Once done you need to start 2 processeses:

1. node scrape/transform-load.js
This will start an MQTT client that subscribes to topics as configured in default.json. Messages received will be transformed and stored into Elastic Search

2. node scrape/main.js
This will start a process that periodically will determine if there are new measurements on MJS that are not yet in Elastic Search. Data is retrieved and published in the MQTT topic as defined in default.json