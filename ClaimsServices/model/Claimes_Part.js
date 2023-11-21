const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const claims_Part = new mongoose.Schema({
  clame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Claims',
    required: true,
  },
  servicepro_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'ServiceProvider',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  serial:{
    type: String,
    required: true,
  },
  manufacture:{
    type: String,
    required: true,
  },
  model:{
    type: String,
    required: true,
  },
  price:{
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('Claims_Part', claims_Part);