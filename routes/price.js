const express = require('express');
const router = express.Router();
const priceController = require('../controller/priceController');

router.get('/', priceController.getAllPriceBook);
//router.post('/', priceController.createUser);

module.exports = router;