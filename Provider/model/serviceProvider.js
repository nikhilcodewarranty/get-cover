const mongoose = require("mongoose");

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
    type: Boolean,
    default: true
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
