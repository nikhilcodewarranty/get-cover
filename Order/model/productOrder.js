const mongoose = require("mongoose");
const productOrderSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "orders",
    required: true,
  },
  dealerBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealerPrice",
    required: true,
  },
  costPerUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealerPrice",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("productOrder", productOrderSchema);
