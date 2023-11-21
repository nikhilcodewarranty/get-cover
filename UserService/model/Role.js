const mongoose = require('mongoose');

const Roles = new mongoose.Schema({
    role: {
      type: String,
      required: true,
    },
  });
  module.exports = mongoose.model('Roles', Roles);