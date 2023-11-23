const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");

router.get("/customers", customerController.getAllCustomers);

module.exports = router;
