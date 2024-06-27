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
    type: mongoose.Schema.Types.ObjectId,ref:"user",
    default: ''
  },
  contentId:{
    type:mongoose.Schema.Types.ObjectId,
    default:null
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
