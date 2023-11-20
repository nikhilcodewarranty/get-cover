const express = require('express');
const router = express.Router();
const serviceController = require('../controller/serviceController');

router.get('/', serviceController.getAllServices);
//router.post('/', serviceController.createUser);

module.exports = router;