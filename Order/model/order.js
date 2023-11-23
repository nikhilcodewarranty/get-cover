const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
    required: true,
  },
  serviceprovId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceProvider",
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "customer",
    required: true,
  },
  orderAmount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    required: true,
  },
  paidAmount: {
    type: Number,
    required: true,
  },
  dueAmount: {
    type: Number,
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  venderOrder: {
    type: String,
    required: true,
  },
  coverageStartDate: {
    type: Date,
    required: true,
  },
  waitPeriodBd: {
    type: Number,
    required: true,
  },
  waitPeriodAdh: {
    type: Number,
    ref: "dealer",
    required: true,
  },
  store: {
    type: String,
    required: true,
  },
  serviceCoverage: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("orders", orderSchema);
