const mongoose = require("mongoose");
const connection = require('../../db')

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceBook",
    // required: true,
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
    // required: true,
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
    // required: true,
  },
},{timestamps:true});
module.exports = connection.dealerConnection.model("dealerPriceBook", dealerBookSchema);
