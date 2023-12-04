const mongoose = require("mongoose");
const connection = require('../../db')

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceBook",
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  status: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: String,
    default: false
  },
  status:{
    type:Boolean,
    default:true
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
