const mongoose = require("mongoose");
const connection = require('../../db')

const dealarSchema = new mongoose.Schema({
  name: {
    type: String,
    default:''
  },
  street: {
    type: String,
    default:''
  },
  city: {
    type: String,
    default:''
  },
  userAccount:{
    type:Boolean,
    defaul:true
  },
  zip: {
    type: String,
    default:''
  },
  state: {
    type: String,
    default:''
  },
  country: {
    type: String,
    default:''
  },
  token: {
    type: String,
    default:''
  },
  createdBy:{
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
},{timestamps:true});

module.exports = connection.dealerConnection.model("dealer", dealarSchema);
