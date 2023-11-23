// app.js
const express = require("express");
const mongoose = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
const port = process.env.Claims_API_ENDPOINT || 8087;
const dbConfig = require("./config/database");
const { databaseConnect } = require("./db");
const claimRoutes = require("./routes/claim");

app.use("/api/v1", claimRoutes);

//Database connection
databaseConnect(dbConfig.claimMongoURI);

app.use(bodyParser.json());
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
