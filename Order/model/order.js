const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  serviceprovId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceProvider",
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "customer",
  },
  orderAmount: {
    type: Number,
  },
  paymentMethod: {
    type: String,
  },
  paymentStatus: {
    type: String,
  },
  paidAmount: {
    type: Number,
  },
  dueAmount: {
    type: Number,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: String,
  },
  venderOrder: {
    type: String,
  },
  coverageStartDate: {
    type: Date,
  },
  waitPeriodBd: {
    type: Number,
  },
  waitPeriodAdh: {
    type: Number,
    ref: "dealer",
  },
  serviceCoverageType: {
    type: String,
  },
  CoverageType: {
    type: String,
  },
  additional_notes: {
    type: String,
  },
  status:{
    type:Boolean,
    default:true
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  send_notification: {
    type: Boolean,
    default:false
  },
},{timestamps:true});

module.exports = mongoose.model("order", orderSchema);
