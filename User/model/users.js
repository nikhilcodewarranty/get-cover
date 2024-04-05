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
    default: '',
     index:true
  },
  password: {
    type: String,
    default: '$2b$10$LVUNmN0okRsnlgyMzqxgvOq0RGQgfZPknOBvQn81fMQ74aU9TPlQe'
  },
  accountId: {
    type: String,
  },
  metaId: {
    type: mongoose.Schema.Types.ObjectId,
    default:null
  },
  resetPasswordCode:{ 
    type:String,
    default:null
  },
  isResetPassword:{
    type:Boolean,
    default:false
  },
  position:{
    type:String,
    default:''
  },
  phoneNumber: {
    type: String,
    default: '',
    index:true
  },
  dialCode: {
    type: String,
    default: "+1",
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId, ref: "roles",
  },
  isPrimary: {
    type: Boolean,
    default: true
  },
  status: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: String,
    default: false
  },
  approvedStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default:"Pending"
  }
}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
