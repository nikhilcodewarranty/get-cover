const express = require("express");
const router = express.Router();// Create a new router instance
const customerController = require("../../controllers/Customer/customerUserController");// Import customer portal controller
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');// Import the validator for request validation
//POST Routes
router.post("/getCustomerOrder", [verifyToken], customerController.customerOrders); // getCustomerOrder route
router.post('/saleReporting', [verifyToken], customerController.saleReporting); // saleReporting route
router.post('/claimReporting', [verifyToken], customerController.claimReporting); // claimReporting route
router.post('/getCustomerContract', [verifyToken], customerController.getCustomerContract); // getCustomerContract route
router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser); // addCustomerUser route
router.post('/getCustomerUsers', [verifyToken], customerController.getCustomerUsers); // getCustomerUsers route
router.post('/getOrderContract/:orderId', [verifyToken], customerController.getOrderContract); // getOrderContract route
//GET Routes
router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser); // changePrimaryUser route
router.get('/getCustomerById', [verifyToken], customerController.getCustomerById); // getCustomerById route
router.get('/getContractById/:contractId', [verifyToken], customerController.getContractById); // getContractById route
router.get('/getOrderById/:orderId', [verifyToken], customerController.getSingleOrder); // getOrderById route
router.get('/getDashboardData', [verifyToken], customerController.getDashboardData); // getDashboardData route
router.get('/getCustomerDetails', [verifyToken], customerController.getCustomerDetails); // getCustomerDetails route
router.get('/getDashboardGraph', [verifyToken], customerController.getDashboardGraph); // getDashboardGraph route
router.get('/getDashboardInfo', [verifyToken], customerController.getDashboardInfo); // getDashboardInfo route

module.exports = router; 
