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
  dealerTitle: {
    type: String,
    default: ''
  },
  servicerTitle: {
    type: String,
    default: ''
  },
  customerTitle: {
    type: String,
    default: ''
  },
  adminTitle: {
    type: String,
    default: ''
  },
  resellerTitle: {
    type: String,
    default: ''
  },
  dealerMessage: {
    type: String,
    default: ''
  },
  servicerMessage: {
    type: String,
    default: ''
  },
  customerMessage: {
    type: String,
    default: ''
  },
  adminMessage: {
    type: String,
    default: ''
  },
  resellerMessage: {
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
  redirectionId: {
    type: String,
    default: ''
  },
  endPoint:{
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
