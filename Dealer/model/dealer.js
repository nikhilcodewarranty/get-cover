const mongoose = require("mongoose");
const connection = require('../../db')

const dealarSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  zip: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  created_by:{
    type: String,
    required: true,
  }
});

module.exports = connection.dealerConnection.model("dealer", dealarSchema);
