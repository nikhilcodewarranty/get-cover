const mongoose = require("mongoose");
const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contract",
    // required: true,
  },
  claimStatus: {
    type: String,
    // required: true,
  },
  action: {
    type: String,
    // required: true,
  },
  bdAdh: {
    type: String,
    // required: true,
  },
  diagnosis: {
    type: String,
    // required: true,
  },
  receiptImage: {
    type: String,
    // required: true,
  },
  shippingCarrier: {
    type: String,
    // required: true,
  },
  shippingLabel: {
    type: String,
    // required: true,
  },
  claimDate: {
    type: Date,
    // required: true,
  },
  claimType: {
    type: String,
    // required: true,
  },
  servicePaymentStatus: {
    type: String,
    // required: true,
  },
  shippingAmount: {
    type: Number,
    // required: true,
  },
  status:{
    type:Boolean,
    default:true
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  totalAmount: {
    type: Number,
    // required: true,
  },
},{timestamps:true});

module.exports = mongoose.model("claim", claimSchema);
