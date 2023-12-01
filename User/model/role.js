const mongoose = require("mongoose");
const connection = require('../../db')
const roleSchema = new mongoose.Schema({
  role: {
    type: String,
    default:''
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: String,
    default: false
  },
});
module.exports = connection.userConnection.model("role", roleSchema);
