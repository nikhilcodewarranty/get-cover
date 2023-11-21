
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');



const usersSchema = new mongoose.Schema({
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    account_name: {
      type: String,
      required: true,
    },
    phone_number: {
      type: String,
      required: true,
    },
    role_id: {
      type: ObjectId,
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

module.exports = mongoose.model('Users', usersSchema);