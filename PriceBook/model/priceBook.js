const mongoose = require("mongoose");
const connection = require('../../db')

const priceSchema = new mongoose.Schema({
  name: {
    type: String,
    index:true
  },
  description: {
    type: String,
  },
  term: {
    type: Number,
    index:true
  },
  frontingFee: {
    type: Number,
  },
  unique_key:{
    type: Number,
  },
  reserveFutureFee: {
    type: Number,
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
    ref: "pricecategories",
    index:true
  },
  userId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  status: {
    type: Boolean,
    default: true,
    index:true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = connection.dealerConnection.model("priceBook", priceSchema);
