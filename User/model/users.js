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
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  roleId: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "role",
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
