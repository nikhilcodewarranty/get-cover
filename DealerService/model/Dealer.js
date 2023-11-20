const mongoose = require('mongoose');

const dealarSchema = new mongoose.Schema({
    name: {
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
    token: {
      type: String,
      required: true,
    },
  });

module.exports = mongoose.model('Dealer', dealarSchema);