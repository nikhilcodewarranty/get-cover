const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
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
  first_name:{
    type: String,
    required: true,
  },
  last_name:{
    type: String,
    required: true,
  },
  password:{
    type: String,
    required: true,
  },
  Street: {
    type: String,
    required: true,
  },
  City: {
    type: String,
    required: true,
  },
  Zip: {
    type: String,
    required: true,
  },
  State: {
    type: String,
    required: true,
  },
  Country: {
    type: String,
    required: true,
  },
  Dealer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Dealer',
    required: true,
  },
  Service_provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'ServiceProvider',
    required: true,
  },
  Token: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Customer', customerSchema);