// app.js
const express = require("express");
const mongoose = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
const port = process.env.Claims_API_ENDPOINT || 8087;
const dbConfig = require("./config/database");
const { databaseConnect } = require("./db");
const claimsRoutes = require("./routes/claims");

app.use("/api/v1", claimsRoutes);

//Database connection
databaseConnect(dbConfig.claimsMongoURI);

app.use(bodyParser.json());
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 
