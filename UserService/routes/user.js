const express = require('express');
const router = express.Router();
const UserController = require('../controller/usersController');

router.get('users/', UserController.getAllUsers);
//router.post('/', UserController.createUser);

module.exports = router;