const express = require('express');
const router = express.Router();
const claimsController = require('../controller/Claims');

router.get('/claims', claimsController.getAllClaims);

module.exports = router;