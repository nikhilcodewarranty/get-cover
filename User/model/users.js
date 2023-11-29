const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },

  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  roleId: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "role",
    required: true,
  },
  isPrimary: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
 
},{timestamps:true});

module.exports = mongoose.model("user", userSchema);
