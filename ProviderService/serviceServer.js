// app.js
const express = require('express');
const mongoose = require("mongodb").MongoClient;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8084;
const dbConfig = require('./config/database');
const {databaseConnect} = require('./db')

const customerRoutes = require('./routes/customer');
 
app.use('/api/v1', customerRoutes);


//Database connection
databaseConnect(dbConfig.serviceMongoURI);

app.use(bodyParser.json());



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
