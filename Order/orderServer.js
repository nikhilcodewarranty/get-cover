// app.js
const express = require('express');
const mongoose = require("mongodb").MongoClient;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8086;
const {databaseConnect} = require('./db')

const orderRoutes = require('./routes/order');

app.use('/api/v1', orderRoutes);



app.use(bodyParser.json());



app.listen(port, () => {
  console.log(`Order server is running on port ${port}`);
});