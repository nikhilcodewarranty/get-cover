const mongoose = require("mongoose");
const usersSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
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
    ref: "roles",
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
});

module.exports = mongoose.model("users", usersSchema);
