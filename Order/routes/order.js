const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware



router.post('/createOrder',[verifyToken],orderController.createOrder)
router.post('/checkFileValidation',[verifyToken],orderController.checkFileValidation)
router.post('/checkMultipleFileValidation',[verifyToken],orderController.checkMultipleFileValidation)
// router.post("/getDealerCustomers/:dealerId", [verifyToken], orderController.getDealerCustomers);

router.post('/getAllOrders',[verifyToken],orderController.getAllOrders)
router.get('/getOrderById/:orderId',[verifyToken],orderController.getSingleOrder)
router.get('/checkOrderToProcessed/:orderId',[verifyToken],orderController.checkOrderToProcessed)

router.post('/getServicerInOrders',[verifyToken],orderController.getServicerInOrders)
router.post('/checkPurchaseOrder',[verifyToken],orderController.checkPurchaseOrder)

router.post('/getCustomerInOrder',[verifyToken],orderController.getCustomerInOrder)
router.post('/getCategoryAndPriceBooks/:dealerId',[verifyToken],orderController.getCategoryAndPriceBooks)


module.exports = router;
