const mongoose = require("mongoose");
const contractSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "order",
    // required: true,
  },
  productName: {
    type: String,
    // required: true,
  },
  orderProductId: {
    type: mongoose.Schema.Types.ObjectId,
    // required: true,
  },
  // description: {
  //   type: String,
  //   // required: true,
  // },
  model: {
    type: String,
    // required: true,
  },
  manufacture: {
    type: String,
    // required: true,
  },
  productValue: {
    type: String,
    // required: true,
  },
  serial: {
    type: String,
    // required: true,
  },
  regDate: {
    type: Date,
    default: Date.now()
  },
  condition: {
    type: String,
    default: ''
  },
  claimStatus: {
    type: String,
    default: ''
    // required: true,
  },
  claimAmount: {
    type: Number,
    // required: true,
    default: 0
  },
  eligibilty: {
    type: String,
    // required: true,
    default: ''
  },
  unique_key: {
    type: String,
    index:true
  },
  unique_key_number: { 
    type: Number,
    index:true
  },
  unique_key_search: {
    type: String,
    index:true
  },
  status: {
    type: String,
    enum: ['Active', 'Waiting', 'Expired', 'Cancelled', 'Refunded', 'Inactive'],
    default: 'Waiting'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deductible: {
    type: Number,
    default:0
    // required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("contract", contractSchema);
