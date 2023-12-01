const mongoose = require("mongoose");
const connection = require('../../db')
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: ''
  },
  accountId: {
    type:String
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,ref:"roles",
  },
  isPrimary: {
    type: String,
    default: ''
  },
  status: {
    type: Boolean,
    default: false
  },

}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
