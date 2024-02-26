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
    default:''
    // required: true,
  },
  diagnosis: {
    type: String,
    // required: true,
  },
  receiptImage: {
    type: {
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
    },
    default: {
      fileName: '',
      originalName: '',
      size:''
    }
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
