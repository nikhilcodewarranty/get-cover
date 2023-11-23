const mongoose = require("mongoose");
const claimStatusSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claim",
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  updateDate: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("claimStatus", claimStatusSchema);
