const mongoose = require("mongoose");
const connection = require('../../db')

const claimStatusSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claims",
  },
  status: {
    type: String,
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  updateDate: {
    type: Date,
  },
},{timestamps:true});

module.exports = connection.userConnection.model("claimStatus", claimStatusSchema);
