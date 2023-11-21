const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    term: {
      type: Number,
      required: true,
    },
    fronting_fee: {
      type: Number,
      required: true,
    },
    reinsurence_fee: {
      type: Number,
      required: true,
    },
    admin_fee: {
      type: Number, 
      required: true,
    },   
    category: {
      type: String,
      required: true,
    },
  });

module.exports = mongoose.model('PriceBook', priceSchema);