const mongoose = require("mongoose");
const connection = require('../../db')

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "pricebooks",
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealers",
  },
  status: {
    type: Boolean,
    default: false
  },
  retailPrice: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  brokerFee: {
    type: Number,
    default:0
  },
  unique_key: {
    type: Number,
  },
},{timestamps:true});
module.exports = connection.dealerConnection.model("dealerPriceBook", dealerBookSchema);



