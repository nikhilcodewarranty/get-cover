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
    type: String,
  },
  isPrimary: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: ''
  },

}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
