const mongoose = require("mongoose");

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
  frontingFee: {
    type: Number,
    required: true,
  },
  reinsurenceFee: {
    type: Number,
    required: true,
  },
  adminFee: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("priceBook", priceSchema);
