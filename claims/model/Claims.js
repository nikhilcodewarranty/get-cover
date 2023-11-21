const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const claimsSchema = new mongoose.Schema({
  contract_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Contracts',
    required: true,
  },
  claims_status: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  bd_adh:{
    type: String,
    required: true,
  },
  diagnosis:{
    type: String,
    required: true,
  },
  receipt_image:{
    type: String,
    required: true,
  },
  shipping_carrier:{
    type: String,
    required: true,
  },
  shipping_label:{
    type: String,
    required: true,
  },
  claim_date: {
    type: Date,
    required: true,
  },
  claim_type: {
    type: String,
    required: true,
  },
  service_payment_status: {
    type: String,
    required: true,
  },
  shipping_amount: {
    type: Number,
    required: true,
  },


  total_amount: {
    type:Number,
    required: true,
  },
});

module.exports = mongoose.model('Claims', claimsSchema);