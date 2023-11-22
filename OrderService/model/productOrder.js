const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const ProductOrderSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Orders',
    required: true,
  },
  dealer_book_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Dealer_Price',
    required: true,
  },
  cost_per_unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Dealer_Price',
    required: true,
  },
  quantity:{
    type: Number,
    required: true,
  },
  total:{
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('Product_Order', ProductOrderSchema);