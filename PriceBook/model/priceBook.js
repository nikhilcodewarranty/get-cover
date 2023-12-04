const mongoose = require("mongoose");
const connection = require('../../db')

const priceSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  description: {
    type: String,
  },
  term: {
    type: Number,
  },
  frontingFee: {
    type: Number,
  },
  reserveFutureFee: {
    type: String,
    default: ''
  },
  reinsuranceFee: {
    type: Number,
  },
  adminFee: {
    type: Number,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceCategory",
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = connection.dealerConnection.model("priceBook", priceSchema);
