const mongoose = require("mongoose");
const contractSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "orders",
    required: true,
  },
  productOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "productOrder",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  manufacture: {
    type: String,
    required: true,
  },
  productValue: {
    type: Number,
    required: true,
  },
  serial: {
    type: String,
    required: true,
  },
  claimAmount: {
    type: Number,
    required: true,
  },
  regDate: {
    type: Date,
    required: true,
  },
  claimsStatus: {
    type: String,
    required: true,
  },
  claimAmount: {
    type: Number,
    required: true,
  },
  eligibilty: {
    type: String,
    required: true,
  },
  covEndDate: {
    type: Date,
    required: true,
  },
  deductible: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("contracts", contractSchema);
