const mongoose = require("mongoose");
const claimPartSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "claims",
    // required: true,
  },
  serviceproId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceproviders",
    // required: true,
  },
  name: {
    type: String,
    // required: true,
  },
  description: {
    type: String,
    // required: true,
  },
  serial: {
    type: String,
    // required: true,
  },
  manufacture: {
    type: String,
    // required: true,
  },
  model: {
    type: String,
    // required: true,
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
    // required: true,
  },
},{timestamps:true});

module.exports = mongoose.model("claimPart", claimPartSchema);
