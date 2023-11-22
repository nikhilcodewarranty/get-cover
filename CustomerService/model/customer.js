const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email:{
    type: String,
    required: true,
  },
  phone:{
    type: String,
    required: true,
  },
  firstName:{
    type: String,
    required: true,
  },
  lastName:{
    type: String,
    required: true,
  },
  password:{
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  zip: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'dealer',
    required: true,
  },
  serviceProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'serviceProvider',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('customer', customerSchema);