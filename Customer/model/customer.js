const mongoose = require("mongoose");
const customerSchema = new mongoose.Schema({
  username: {
    type: String,
    default:''
  },
  email: {
    type: String,
    default:''
  },
  phone: {
    type: String,
    default:''
  },
  firstName: {
    type: String,
    default:''
  },
  lastName: {
    type: String,
    default:''
  },
  password: {
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
  zip: {
    type: String,
    default:''
  },
  unique_key:{
    type :Number,
  },
  state: {
    type: String,
    default:''
  },
  country: {
    type: String,
    default:''
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealers",
  },
  dealerName:{
    type:String,
    default:''
  },
  // dealerId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "dealers",
  // },
  status: {
    type: Boolean,
    default:true
  },
  accountStatus:{
    type:String,
    enum: ["Pending", "Approved", "Rejected"],
    default:"Pending"
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
  token: {
    type: String,
    default:''
  },
},{timestamps:true});

module.exports = mongoose.model("customer", customerSchema);
