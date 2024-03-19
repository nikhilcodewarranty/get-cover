const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

console.log('sdnfksdfksjfksdjf')

router.post("/getCustomerOrder", [verifyToken], customerController.customerOrders)
router.get('/getOrderById/:orderId', [verifyToken], customerController.getSingleOrder)
router.post('/getCustomerContract', [verifyToken], customerController.getCustomerContract)
router.post('/addCustomerUser', [verifyToken], customerController.addCustomerUser)
router.post('/getCustomerUsers', [verifyToken], customerController.getCustomerUsers)
router.get('/changePrimaryUser/:userId', [verifyToken], customerController.changePrimaryUser)


module.exports = router; 
