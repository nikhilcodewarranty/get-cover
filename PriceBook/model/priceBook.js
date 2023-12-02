const mongoose = require("mongoose");
const connection = require('../../db')

const priceSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
  },
  description: {
    type: String,
    // required: true,
  },
  term: {
    type: Number,
    // required: true,
  },
  frontingFee: {
    type: Number,
    // required: true,
  },
  reinsuranceFee: {
    type: Number,
    // required: true,
  },
  adminFee: {
    type: Number,
    // required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceCategory",
    // required: true,
  },
  status:{
    type:Boolean,
    default:true
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
},{timestamps:true});

module.exports = connection.dealerConnection.model("priceBook", priceSchema);
