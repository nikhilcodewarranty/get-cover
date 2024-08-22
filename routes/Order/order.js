const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/Order/order"); // order controller
const orderCreateController = require("../../controllers/Order/orderCreateController"); // order create and edit controller
const supportingController = require("../../controllers/Order/supportingController"); // supporting function for order section
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const supportingFunction =  require("../../config/supportingFunction");

router.post('/createOrder', [verifyToken], orderCreateController.createOrder1); // create order
router.post('/editOrderDetail/:orderId', [verifyToken], orderCreateController.editOrderDetail); // edit order detail
router.post('/checkFileValidation', [verifyToken], orderCreateController.checkFileValidation); // check file validation
router.post('/checkMultipleFileValidation', [verifyToken], orderCreateController.checkMultipleFileValidation); // check multiple file validation
router.post('/editFileCase', [verifyToken], orderCreateController.editFileCase); // edit file case
router.post('/getOrderContract/:orderId', [verifyToken], supportingFunction.checkObjectId, orderCreateController.getOrderContract); // get order contract

router.post('/archiveOrder/:orderId', [verifyToken], supportingFunction.checkObjectId,orderController.archiveOrder); // archive order
router.post('/processOrder/:orderId', [verifyToken], supportingFunction.checkObjectId,orderController.processOrder); // process order
router.post('/getAllOrders', [verifyToken], orderController.getAllOrders); // get all orders
router.post('/getArchieveOrder', [verifyToken], orderController.getAllArchieveOrders); // get archived orders
router.post('/getPendingAmount/:orderId', [verifyToken], orderController.getPendingAmount); // get pending amount for an order
router.post('/getOrderPdf/:orderId', [verifyToken], orderController.getOrderPdf); // get order PDF
router.post('/getServicerByOrderId/:orderId', [verifyToken], orderController.getServicerByOrderId); // get servicer by order ID
router.post('/checkPurchaseOrder', [verifyToken], orderController.checkPurchaseOrder); // check purchase order
router.post('/getResellerByDealerAndCustomer', [verifyToken], orderController.getResellerByDealerAndCustomer); // get reseller by dealer and customer
router.post('/getCustomerInOrder', [verifyToken], orderController.getCustomerInOrder); // get customer in order
router.post('/getCategoryAndPriceBooks/:dealerId', [verifyToken], orderController.getCategoryAndPriceBooks); // get category and price books by dealer ID
router.post('/getPriceBooksInOrder/:dealerId', [verifyToken], orderController.getPriceBooksInOrder); // get price books in order by dealer ID
router.put('/updateServicerByOrder/:orderId', [verifyToken], orderController.updateServicerByOrder); // update servicer by order ID
router.get('/getOrderById/:orderId', [verifyToken],supportingFunction.checkObjectId, orderController.getSingleOrder); // get order by ID
router.get('/markAsPaid/:orderId', [verifyToken], orderController.markAsPaid); // mark order as paid
router.get('/getServiceCoverage/:dealerId', [verifyToken], orderController.getServiceCoverage); // get service coverage by dealer ID

router.post('/getServicerInOrders', [verifyToken], supportingController.getServicerInOrders); // get servicer in orders
router.post("/getDealerResellers", [verifyToken], supportingController.getDealerResellers); // get dealer resellers
router.post('/getDashboardData', [verifyToken], supportingController.getDashboardData); // get dashboard data
router.post('/cronJobStatusWithDate', supportingController.cronJobStatusWithDate); // cron job status with date
router.get('/cronJobStatus', supportingController.cronJobStatus); // cron job status
router.get('/generateHtmltopdf/:orderId', [verifyToken], supportingController.generateHtmltopdf); // generate HTML to PDF by order ID
router.get('/reportingDataCreation',  supportingController.reportingDataCreation); // reporting data creation
router.get('/reportingDataReCreation', [verifyToken], supportingController.reportingDataReCreation); // reporting data re-creation




module.exports = router;