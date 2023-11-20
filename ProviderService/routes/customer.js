const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');

router.get('/customers', customerController.getAllCustomer);
//router.post('/', dealerController.createUser);

module.exports = router;