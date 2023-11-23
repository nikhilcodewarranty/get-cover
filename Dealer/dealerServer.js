// app.js
const express = require("express");
const mongoose = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
const port = process.env.BOOKS_API_PORT || 8082;
const dbConfig = require("./config/database");
const { databaseConnect } = require("./db");

const dealerRoutes = require("./routes/dealer");

app.use("/api/v1", dealerRoutes);

//Database connection
databaseConnect(dbConfig.dealersMongoURI);

app.use(bodyParser.json());

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
