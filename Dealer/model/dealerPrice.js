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
    index:true
  },
  status: {
    type: Boolean,
    default: false,
    index:true
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
  wholesalePrice:{
    type: Number,
    default: 0
  }
},{timestamps:true});
module.exports = connection.dealerConnection.model("dealerPriceBook", dealerBookSchema);



