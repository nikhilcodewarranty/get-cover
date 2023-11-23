// app.js
const express = require('express');
const mongoose = require("mongodb").MongoClient;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8085;
const dbConfig = require('./config/database');
const {databaseConnect} = require('./db')

const orderRoutes = require('./routes/order');

app.use('/api/v1', orderRoutes);


//Database connection
databaseConnect(dbConfig.ordersMongoURI);

app.use(bodyParser.json());



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});