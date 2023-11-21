const mongoose = require('mongoose');

const priceCategory = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

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
      type: mongoose.Schema.Types.ObjectId,
      ref:'PriceCategory',
      required: true,
    },
  }); 

module.exports = mongoose.model('PriceBook', priceSchema);
module.exports = mongoose.model('PriceCategory', priceCategory);