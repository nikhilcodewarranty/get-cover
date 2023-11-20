const express = require('express');
const router = express.Router();
const priceController = require('./controller');

router.get('/', priceController.getAllUsers);
//router.post('/', priceController.createUser);

module.exports = router;