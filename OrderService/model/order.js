const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const orderSchema = new mongoose.Schema({
  dealer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Dealer',
    required: true,
  },
  serviceprov_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'ServiceProvider',
    required: true,
  },
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Customer',
    required: true,
  },
  order_amount:{
    type: Number,
    required: true,
  },
  payment_method:{
    type: String,
    required: true,
  },
  payment_status:{
    type: String,
    required: true,
  },
  paid_amount:{
    type: Number,
    required: true,
  },
  due_amount:{
    type: Number,
    required: true,
  },
  order_date: {
    type: Date,
    default:Date.now,
    required: true,
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Users',
    required: true,
  },
  vender_order: {
    type: String,
    required: true,
  },
  coverage_start_date: {
    type: Date,
    required: true,
  },
  wait_period_bd: {
    type: Number,
    required: true,
  },
  wait_period_adh: {
    type: Number,
    ref:'Dealer',
    required: true,
  },
  store: {
    type:String,
    required: true,
  },
  service_coverage: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Orders', orderSchema);