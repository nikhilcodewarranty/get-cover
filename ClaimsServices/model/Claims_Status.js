const mongoose = require('mongoose');
// Email, Phone, First Name, Last Name, Password
const claims_status = new mongoose.Schema({
  clame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Claims',
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  update_date: {
    type: Date,
    required: true,
  },
 
});

module.exports = mongoose.model('Claims_Status', claims_status);