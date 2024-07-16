const mongoose = require("mongoose");
const connection = require('../../db')

const claimPartSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claims",
  },
  serviceproId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceproviders",
  },
  name: {
    type: String,
  },
  description: {
    type: String,
  },
  serial: {
    type: String,
  },
  manufacture: {
    type: String,
  },
  model: {
    type: String,
  },
  status:{
    type:Boolean,
    default:true
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  price: {
    type: Number,
  },
},{timestamps:true});

module.exports = connection.userConnection.model("claimPart", claimPartSchema);
