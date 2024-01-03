const mongoose = require("mongoose");
const connection = require('../../db')
const serviceProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    default:'',
    index:true
  },
  street: {
    type: String,
    default:''
  },
  city: {
    type: String,
    default:''
  },
  unique_key:{
    type: Number,
  },
  userAccount:{
    type:Boolean,
    default:false
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
    type: Boolean,
    default:true
  },
  accountStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default:"Pending"
  },
  isDeleted: {
    type: String,
    default: false
  }
},{timestamps:true});

module.exports = mongoose.model("serviceProvider", serviceProviderSchema);
