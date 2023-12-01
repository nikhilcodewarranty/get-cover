const mongoose = require("mongoose");
const connection = require('../../db')

const dealarSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  street: {
    type: String,
  },
  city: {
    type: String,
  },
  zip: {
    type: String,
  },
  state: {
    type: String,
  },
  country: {
    type: String,
  },
  token: {
    type: String,
  },
  createdBy:{
    type: String,
  }
});

module.exports = connection.dealerConnection.model("dealer", dealarSchema);
