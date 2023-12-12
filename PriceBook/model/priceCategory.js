const mongoose = require("mongoose");
const connection = require('../../db')
const priceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
  },
  description: {
    type: String,
  },
  status: {
    type: Boolean,
    default: true
  },
  unique_key: {
    type: String,
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = connection.dealerConnection.model("priceCategory", priceCategorySchema);
