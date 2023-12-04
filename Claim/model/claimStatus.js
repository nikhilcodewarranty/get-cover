const mongoose = require("mongoose");
const claimStatusSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claim",
    // required: true,
  },
  status: {
    type: String,
    // required: true,
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  updateDate: {
    type: Date,
    // required: true,
  },
},{timestamps:true});

module.exports = mongoose.model("claimStatus", claimStatusSchema);
