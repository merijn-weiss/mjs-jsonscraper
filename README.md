# mjs-jsonscraper
Experimental application to extra data from MJS, parse the data into a common format and store the results into Elastic. 

To run the application you need to create a .env file in the root folder with the following keys to configure access to a Elastic Cloud instance:

    NODE_ENV=
    ES_CLOUDID=
    ES_USERNAME=
    ES_PASSWORD=

Once done you need to start 1 process

1. node mjs/main.js
This will start a process that periodically will determine if there are new measurements on MJS that are not yet in Elastic Search. Data is retrieved and published on the MJS index as defined in default.json