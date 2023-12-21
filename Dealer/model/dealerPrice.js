const mongoose = require("mongoose");
const connection = require('../../db')

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceBooks",
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
  isDeleted:{
    type:Boolean,
    default:false
  },
  brokerFee: {
    type: Number,
    default:0
  },
},{timestamps:true});
module.exports = connection.dealerConnection.model("dealerPriceBook", dealerBookSchema);
