const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");

router.get("/customer", customerController.getAllCustomers);
router.get("/customer/create-customer", customerController.createCustomer);
router.post('/createCustomer',customerController.createCustomer)

module.exports = router;
