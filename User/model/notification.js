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
  description: {
    type: String,
    default: ''
  },
  userId: {
    type: String,
    default: ''
  },
  isOpenByAdmin: {
    type: Boolean,
    default: false
  },
  isOpenByDealer: {
    type: Boolean,
    default: false
  },
  isOpenByReseller: {
    type: Boolean,
    default: false
  },
  isOpenByServicer: {
    type: Boolean,
    default: false
  },
  isOpenByCustomer: {
    type: Boolean,
    default: false
  },
  isReadByAdmin: {
    type: Boolean,
    default: false
  },
  isReadByDealer: {
    type: Boolean,
    default: false
  },
  isReadByReseller: {
    type: Boolean,
    default: false
  },
  isReadByServicer: {
    type: Boolean,
    default: false
  },
  isReadByCustomer: {
    type: Boolean,
    default: false
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
