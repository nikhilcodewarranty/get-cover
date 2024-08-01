const express = require("express"); //Import the express module
const router = express.Router();// Create a new router instance
const customerController = require("../controller/customerController");// Import the customer controller module
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation'); // Import the verifyToken middleware

router.post("/customer", [verifyToken], customerController.getAllCustomers); //  getAllCustomers route

router.post("/getDealerCustomers/:dealerId", [verifyToken], customerController.getDealerCustomers); // getDealerCustomers route

router.post("/getResellerCustomers/:resellerId", [verifyToken], customerController.getResellerCustomers); //getResellerCustomers route

router.get("/create-customer", [verifyToken], validator('createCustomerValidation'), [verifyToken], customerController.createCustomer); // createCustomer route

router.post('/createCustomer', [verifyToken], validator('createCustomerValidation'), customerController.createCustomer); // createCustomer route

router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser); //addCustomerUser route

router.post('/customerOrders/:customerId', [verifyToken], customerController.customerOrders); //customerOrders route

router.post('/getCustomerContract/:customerId', [verifyToken], customerController.getCustomerContract); //getCustomerContract route

router.put('/editCustomer/:customerId', [verifyToken], customerController.editCustomer); //editCustomer route

router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser); //changePrimaryUser route

router.get('/getCustomerById/:customerId', [verifyToken], customerController.getCustomerById); //getCustomerById route

router.post('/getCustomerUsers/:customerId', [verifyToken], customerController.getCustomerUsers); //getCustomerUsers route

router.post('/customerClaims/:customerId', [verifyToken], customerController.customerClaims); //customerClaims route

module.exports = router;


 