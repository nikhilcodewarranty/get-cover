const mongoose = require("mongoose");
const connection = require('../../db')
const serviceProviderSchema = new mongoose.Schema({
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
  state: {
    type: String,
    default:''
  },
  zip: {
    type: String,
    default:''
  },
  country: {
    type: String,
    default:''
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default:"Pending"
  },
  isDeleted: {
    type: String,
    default: false
  },
  token: {
    type: String,
    default:''
  },
},{timestamps:true});

module.exports = mongoose.model("serviceProvider", serviceProviderSchema);
