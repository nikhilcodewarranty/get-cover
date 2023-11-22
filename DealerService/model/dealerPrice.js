const mongoose = require('mongoose');

const dealerBook = new mongoose.Schema({
    price_book: {
      type: mongoose.Schema.Types.ObjectId,
      ref:'PriceBook',
      required: true,
    },
    dealer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref:'Dealer',
      required: true,
    },
    broker_fee: {
      type: Number,
      required: true,
    }
  });
  module.exports = mongoose.model('Dealer_Price', dealerBook);