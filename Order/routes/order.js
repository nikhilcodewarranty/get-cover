const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware



router.post('/createOrder', [verifyToken], orderController.createOrder1)
router.post('/editOrderDetail/:orderId', [verifyToken], orderController.editOrderDetail)
router.post('/archiveOrder/:orderId', [verifyToken], orderController.archiveOrder)
router.post('/processOrder/:orderId', [verifyToken], orderController.processOrder)
router.post('/checkFileValidation', [verifyToken], orderController.checkFileValidation)
router.post('/checkMultipleFileValidation', [verifyToken], orderController.checkMultipleFileValidation)
router.post('/generatePDF/:orderId', [verifyToken], orderController.generatePDF)
//router.post('/multipleFileValidation', [verifyToken], orderController.multipleFileValidation)

// router.post("/getDealerCustomers/:dealerId", [verifyToken], orderController.getDealerCustomers);

router.post('/getAllOrders', [verifyToken], orderController.getAllOrders) 
//router.post('/getOrder', [verifyToken], orderController.getOrder)
router.post('/editFileCase', [verifyToken], orderController.editFileCase)
router.post('/getArchieveOrder', [verifyToken], orderController.getAllArchieveOrders)
router.post('/getPendingAmount/:orderId', [verifyToken], orderController.getPendingAmount)

router.get('/getOrderById/:orderId', [verifyToken], orderController.getSingleOrder)
router.get('/markAsPaid/:orderId', [verifyToken], orderController.markAsPaid)
router.post('/getOrderContract/:orderId', [verifyToken], orderController.getOrderContract)
router.post('/getOrderPdf/:orderId', [verifyToken], orderController.getOrderPdf)
// router.get('/checkOrderToProcessed/:orderId',[verifyToken],orderController.checkOrderToProcessed)

router.post('/getServicerInOrders', [verifyToken], orderController.getServicerInOrders)

router.post("/getDealerResellers", [verifyToken], orderController.getDealerResellers)

router.get('/getServiceCoverage/:dealerId', [verifyToken], orderController.getServiceCoverage)


router.post('/getServicerByOrderId/:orderId', [verifyToken], orderController.getServicerByOrderId)
router.put('/updateServicerByOrder/:orderId', [verifyToken], orderController.updateServicerByOrder)
router.get('/cronJobStatus', orderController.cronJobStatus)
router.post('/cronJobStatusWithDate', orderController.cronJobStatusWithDate)
router.get('/generateHtmltopdf/:orderId', orderController.generateHtmltopdf)

router.post('/checkPurchaseOrder', [verifyToken], orderController.checkPurchaseOrder)
router.post('/getDashboardData', [verifyToken], orderController.getDashboardData)
router.post('/getResellerByDealerAndCustomer', [verifyToken], orderController.getResellerByDealerAndCustomer)

router.post('/getCustomerInOrder', [verifyToken], orderController.getCustomerInOrder)
router.post('/getCategoryAndPriceBooks/:dealerId', [verifyToken], orderController.getCategoryAndPriceBooks)


module.exports = router;
 