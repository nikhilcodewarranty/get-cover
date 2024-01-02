const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');


router.get("/customer",[verifyToken], customerController.getAllCustomers);
router.get("/getDealerCustomers/:dealerId", [verifyToken],customerController.getDealerCustomers);
router.get("/create-customer", validator('createCustomerValidation'),[verifyToken] ,customerController.createCustomer);
router.post('/createCustomer',validator('createCustomerValidation'),customerController.createCustomer)

module.exports = router;
