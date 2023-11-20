// app.js
const express = require('express');
const mongoose = require("mongodb").MongoClient;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8080;
const dbConfig = require('./config/database');
const {databaseConnect} = require('./db')

const userRoutes = require('./routes/user');

app.use('/api/v1', userRoutes);


//Database connection
databaseConnect(dbConfig.usersMongoURI);

app.use(bodyParser.json());



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
