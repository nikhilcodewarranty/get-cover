const mongoose = require("mongoose");
const claimPartSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claim",
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

module.exports = mongoose.model("claimPart", claimPartSchema);
