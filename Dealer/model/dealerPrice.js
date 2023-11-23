const mongoose = require("mongoose");

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "priceBook",
    required: true,
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
    required: true,
  },
  brokerFee: {
    type: Number,
    required: true,
  },
});
module.exports = mongoose.model("dealerPrice", dealerBookSchema);
