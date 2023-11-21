const mongoose = require('mongoose');



// Email, Phone, First Name, Last Name, Password
const customerSchema = new mongoose.Schema({
  Name: {
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
    type: String,
    required: true,
  },
  Service_provider: {
    type: String,
    required: true,
  },
  Token: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Customer', customerSchema);