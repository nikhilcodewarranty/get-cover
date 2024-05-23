const mongoose = require("mongoose");
const contractSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "order",
    index: true,
  },
  orderUniqueKey: {
    type: String
  },
  venderOrder: {
    type: String
  },
  productName: {
    type: String,
    index: true,
    // required: true,
  },
  pName: {
    type: String,
    index: true,
    default: ''
    // required: true,
  },
  partsWarranty: {
    type: Date,
    default: null
  },
  labourWarranty: {
    type: Date,
    default: null
  },
  purchaseDate: {
    type: Date,
    default: null
  },
  minDate: {
    type: Date,
    default: null
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
    index: true,
    // required: true,
  },
  manufacture: {
    type: String,
    index: true,
    // required: true,
  },
  productValue: {
    type: String,
    // required: true,
  },
  serial: {
    type: String,
    index: true,
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
  },
  claimAmount: {
    type: Number,
    default: 0
  },
  eligibilty: {
    type: Boolean,
    default: false
  },
  unique_key: {
    type: String,
    index: true
  },
  coverageStartDate: {
    type: Date,
    default: Date.now(),
  },
  coverageEndDate: {
    type: Date,
    default: '',
  },
  unique_key_number: {
    type: Number,
    index: true
  },
  unique_key_search: {
    type: String,
    index: true
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
    default: 0
    // required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("contract", contractSchema);
