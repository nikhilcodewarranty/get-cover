const mongoose = require("mongoose");
const connection = require('../../db')
const productOrderSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "order",
    // required: true,
  },
  dealerBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealerPrice",
    // required: true,
  },
  costPerUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealerPrice",
    // required: true,
  },
  quantity: {
    type: Number,
    // required: true,
  },
  total: {
    type: Number,
    // required: true,
  },
},{timestamps:true});

module.exports = connection.userConnection.model("productOrder", productOrderSchema);
