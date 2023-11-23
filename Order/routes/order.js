const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");

router.get("/order", orderController.getAllOrders);
router.get("/order/create-order", orderController.createOrder);

module.exports = router;
