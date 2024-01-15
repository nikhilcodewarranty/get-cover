const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post('/createOrder',[verifyToken],orderController.createOrder)



module.exports = router;
