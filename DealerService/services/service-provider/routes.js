const express = require('express');
const router = express.Router();
const serviceController = require('./controller');

router.get('/', serviceController.getAllUsers);
//router.post('/', serviceController.createUser);

module.exports = router;