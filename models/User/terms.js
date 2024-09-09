const mongoose = require("mongoose");
const connection = require('../../db')
const termSchema = new mongoose.Schema({
  terms: {
    type: Number,
    default:''
  },
  status: {
    type: Boolean,
    default:true
  },
  isDeleted: {
    type: String,
    default: false
  },
},{timestamps:true});
module.exports = connection.userConnection.model("terms", termSchema);
