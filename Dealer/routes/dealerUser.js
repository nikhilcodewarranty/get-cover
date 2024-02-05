const express = require("express");
const router = express.Router();
const dealerUserController = require("../controller/dealerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/getDealerUsers',[verifyToken],dealerUserController.getDealerUsers)
router.post('/getPriceBooks',[verifyToken],dealerUserController.getPriceBooks)
router.post('/getAllPriceBooksByFilter',[verifyToken],dealerUserController.getAllPriceBooksByFilter)
router.post('/getDealerServicers',[verifyToken],dealerUserController.getDealerServicers)


module.exports = router; 
