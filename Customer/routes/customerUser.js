const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post("/getCustomerOrder", [verifyToken], customerController.customerOrders)
router.post('/getCustomerContract', [verifyToken], customerController.getCustomerContract)
router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser)
router.post('/getCustomerUsers', [verifyToken], customerController.getCustomerUsers)
router.post('/getOrderContract/:orderId', [verifyToken], customerController.getOrderContract)

router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser)
router.get('/getCustomerById', [verifyToken], customerController.getCustomerById)
router.get('/getContractById/:contractId',[verifyToken],customerController.getContractById)
router.get('/getOrderById/:orderId', [verifyToken], customerController.getSingleOrder)
router.get('/getDashboardData',[verifyToken],customerController.getDashboardData)
router.get('/getCustomerDetails',[verifyToken],customerController.getCustomerDetails)
router.get('/getDashboardInfo', [verifyToken], customerController.getDashboardInfo)




module.exports = router; 
