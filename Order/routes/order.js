const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");

router.get("/orders", orderController.getAllOrders);

module.exports = router;
