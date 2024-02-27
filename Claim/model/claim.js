const mongoose = require("mongoose");
const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contract",
    // required: true,
  },
  claimStatus: {
    type: String,
    default: ''
    // required: true,
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
    type: [{
      fileName: {
        type: String,
        default: ''
      },
      name: {
        type: String,
        default: ''
      },
      size: {
        type: String,
        default: ''
      },
    }],
    default: [{
      fileName: '',
      originalName: '',
      size: ''
    }]
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
  totalAmount: {
    type: Number,
    default: 0
    // required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("claim", claimSchema);
