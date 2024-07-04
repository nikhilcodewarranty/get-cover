const mongoose = require("mongoose");
const connection = require('../../db')

const claimStatusSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claims",
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

module.exports = connection.userConnection.model("claimStatus", claimStatusSchema);
