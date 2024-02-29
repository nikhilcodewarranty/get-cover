const mongoose = require("mongoose");
const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contracts",
    // required: true,
  },
  claimStatus: {
    type: 'String',
    enum: ['Open', 'Completed', 'Rejected'],
    default: 'Open'
    // required: true,
  },
  unique_key_number: {
    type: Number,
  },
  unique_key_search: {
    type: String,
  },
  unique_key: {
    type: String,
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceproviders",
    default: null
  },
  action: {
    type: String,
    // required: true,
  },
  bdAdh: {
    type: String,
    default: ''
    // required: true,
  },
  diagnosis: {
    type: String,
    // required: true,
  },
  receiptImage: {
    type: [],
    default: []
  },
  shippingCarrier: {
    type: String,
    default: ''
    // required: true,
  },
  shippingLabel: {
    type: String,
    default: ''
    // required: true,
  },
  claimDate: {
    type: Date,
    default: Date.now()
    // required: true,
  },
  lossDate: {
    type: Date,
    default: Date.now()
    // required: true,
  },
  claimType: {
    type: String,
    default: ''
  },
  servicePaymentStatus: {
    type: String,
    default: 'Pending'
  },
  shippingAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  repairParts: {
    type: [],
    default: []
  },
  totalAmount: {
    type: Number,
    default: 0
    // required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("claim", claimSchema);
