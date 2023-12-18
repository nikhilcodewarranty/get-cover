const mongoose = require("mongoose");
const connection = require('../../db')
const notificationSchema = new mongoose.Schema({
  status: {
    type: Boolean,
    default:false
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  userId: {
    type: String,
    default: ''
  },
  isDeleted: {
    type: String,
    default: false
  },
},{ timestamps: true });
module.exports = connection.userConnection.model("notification", notificationSchema);
