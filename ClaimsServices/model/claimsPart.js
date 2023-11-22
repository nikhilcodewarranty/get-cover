const mongoose = require("mongoose");
const claimsPart = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claims",
    required: true,
  },
  serviceproId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceProvider",
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
  serial: {
    type: String,
    required: true,
  },
  manufacture: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("claimsPart", claimsPart);
