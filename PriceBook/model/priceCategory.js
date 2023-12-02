const mongoose = require("mongoose");
const connection = require('../../db')
const priceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
  },
  description: {
    type: String,
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

module.exports = connection.dealerConnection.model("priceCategory", priceCategorySchema);
