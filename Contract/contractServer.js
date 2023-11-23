// app.js
const express = require("express");
const mongoose = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
const port = process.env.Contracts_API_ENDPOINT || 8085;
const dbConfig = require("./config/database");
const { databaseConnect } = require("./db");
const contractRoutes = require("./routes/contract");

app.use("/api/v1", contractRoutes);

//Database connection
databaseConnect(dbConfig.contractMongoURI);

app.use(bodyParser.json());
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
