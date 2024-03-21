const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');


router.post("/customer", [verifyToken], customerController.getAllCustomers);
router.post("/getDealerCustomers/:dealerId", [verifyToken], customerController.getDealerCustomers);
router.post("/getResellerCustomers/:resellerId", [verifyToken], customerController.getResellerCustomers);
router.get("/create-customer", [verifyToken], validator('createCustomerValidation'), [verifyToken], customerController.createCustomer);
router.post('/createCustomer', [verifyToken], validator('createCustomerValidation'), customerController.createCustomer)
router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser)
router.post('/customerOrders/:customerId', [verifyToken], customerController.customerOrders)
router.post('/getCustomerContract/:customerId', [verifyToken], customerController.getCustomerContract)
router.put('/editCustomer/:customerId', [verifyToken], customerController.editCustomer)
router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser)
router.get('/getCustomerById/:customerId', [verifyToken], customerController.getCustomerById)
router.post('/getCustomerUsers/:customerId', [verifyToken], customerController.getCustomerUsers)
router.post('/customerClaims/:customerId', [verifyToken], customerController.getCustomerClaims)

module.exports = router; 
