//* Module setup the ElasticClient */
'use strict'

// Setup the Client
const { Client } = require('@elastic/elasticsearch');

const ElasticClient = new Client({
  cloud: {
    id: process.env.ES_CLOUDID
  },
  auth: {
    username: process.env.ES_USERNAME,
    password: process.env.ES_PASSWORD
  }
});

module.exports = {
    ElasticClient
};