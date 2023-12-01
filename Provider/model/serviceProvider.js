const mongoose = require("mongoose");

const serviceProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zip: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
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
    required: true,
  },
},{timestamps:true});

module.exports = mongoose.model("serviceProvider", serviceProviderSchema);
