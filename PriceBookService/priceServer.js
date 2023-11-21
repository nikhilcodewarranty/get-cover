// app.js
const express = require('express');
const mongoose = require("mongodb").MongoClient;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8083;
const dbConfig = require('./config/database');
const {databaseConnect} = require('./db')

const priceRoutes = require('./routes/price');

app.use('/api/v1', priceRoutes);


//Database connection
databaseConnect(dbConfig.priceMongoURI);

app.use(bodyParser.json());



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
