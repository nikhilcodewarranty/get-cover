const express = require('express');
const router = express.Router();
const UserController = require('./controller');

router.get('/', UserController.getAllUsers);
//router.post('/', UserController.createUser);

module.exports = router;