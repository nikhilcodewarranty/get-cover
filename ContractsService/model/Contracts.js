const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const contractSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Orders',
    required: true,
  },
  product_order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Product_Order',
    required: true,
  },
  product_name: {
    type: String,
    required: true,
  },
  description:{
    type: String,
    required: true,
  },
  model:{
    type: String,
    required: true,
  },
  manufacture:{
    type: String,
    required: true,
  },
  product_value:{
    type: Number,
    required: true,
  },
  serial:{
    type: String,
    required: true,
  },
  claim_amount: {
    type: Number,
    required: true,
  },
  reg_date: {
    type: Date,
    required: true,
  },
  claims_status: {
    type: String,
    required: true,
  },
  claim_amount: {
    type: Number,
    required: true,
  },
  eligibilty: {
    type: String,
    required: true,
  },
  cov_end_date: {
    type: Date,
    required: true,
  },
  deductible: {
    type:Number,
    required: true,
  },
});

module.exports = mongoose.model('Contracts', contractSchema);