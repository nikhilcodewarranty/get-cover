const mongoose = require("mongoose");
const connection = require('../../db')
const notificationSchema = new mongoose.Schema({
  status: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  notificationFor: {
    type: [],
    default: []
  },
  readBy: {
    type: [],
    default: []
  },
  openBy: {
    type: [],
    default: []
  },
  description: {
    type: String,
    default: ''
  },
  userId: {
    type: String,
    default: ''
  },
  flag: {
    type: String,
    default: ''
  },
  flagId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  isDeleted: {
    type: String,
    default: false
  },
}, { timestamps: true });
module.exports = connection.userConnection.model("notification", notificationSchema);
