const mongoose = require('mongoose');
const claimsStatus = new mongoose.Schema({
  clameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'claims',
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  updateDate: {
    type: Date,
    required: true,
  },
 
});

module.exports = mongoose.model('claimsStatus', claimsStatus);