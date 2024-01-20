const express = require("express");
const router = express.Router();
const resellerController = require("../controller/resellerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/createReseller',[verifyToken],resellerController.createReseller)
router.post('/getAllResellers',[verifyToken],resellerController.getAllResellers)

module.exports = router; 
