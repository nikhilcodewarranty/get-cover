const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');


router.post("/customer", [verifyToken], customerController.getAllCustomers);
router.get("/getDealerCustomers/:dealerId", [verifyToken], customerController.getDealerCustomers);
router.get("/create-customer", [verifyToken], validator('createCustomerValidation'), [verifyToken], customerController.createCustomer);
router.post('/createCustomer', [verifyToken], validator('createCustomerValidation'), customerController.createCustomer)
router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser)
router.put('/editCustomer/:dealerId', [verifyToken], customerController.editCustomer)
router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser)

module.exports = router;
