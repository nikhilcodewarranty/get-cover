const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware



router.post('/createOrder', [verifyToken], orderController.createOrder)
router.post('/editOrderDetail/:orderId', [verifyToken], orderController.editOrderDetail)
router.post('/archiveOrder/:orderId', [verifyToken], orderController.archiveOrder)
router.post('/processOrder/:orderId', [verifyToken], orderController.processOrder)
router.post('/checkFileValidation', [verifyToken], orderController.checkFileValidation)
router.post('/checkMultipleFileValidation', [verifyToken], orderController.checkMultipleFileValidation)
//router.post('/multipleFileValidation', [verifyToken], orderController.multipleFileValidation)

// router.post("/getDealerCustomers/:dealerId", [verifyToken], orderController.getDealerCustomers);

router.post('/getAllOrders', [verifyToken], orderController.getAllOrders)
router.post('/editFileCase', [verifyToken], orderController.editFileCase)
router.post('/getArchieveOrder', [verifyToken], orderController.getAllArchieveOrders)
router.get('/getOrderById/:orderId', [verifyToken], orderController.getSingleOrder)
router.get('/markAsPaid/:orderId', [verifyToken], orderController.markAsPaid)
router.get('/getOrderContract/:orderId', [verifyToken], orderController.getOrderContract)
// router.get('/checkOrderToProcessed/:orderId',[verifyToken],orderController.checkOrderToProcessed)

router.post('/getServicerInOrders', [verifyToken], orderController.getServicerInOrders)
router.post('/checkPurchaseOrder', [verifyToken], orderController.checkPurchaseOrder)
router.post('/getDashboardData', [verifyToken], orderController.getDashboardData)

router.post('/getCustomerInOrder', [verifyToken], orderController.getCustomerInOrder)
router.post('/getCategoryAndPriceBooks/:dealerId', [verifyToken], orderController.getCategoryAndPriceBooks)


module.exports = router;
