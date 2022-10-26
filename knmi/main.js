require('dotenv').config();

const extract = require('../knmi/extractAndStore.js');
extract.ScrapeKNMI();