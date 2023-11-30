const mongoose = require("mongoose");
const connection = require('../../db')
const roleSchema = new mongoose.Schema({
  role: {
    type: String,
    default:''
  },
});
module.exports = connection.userConnection.model("role", roleSchema);
