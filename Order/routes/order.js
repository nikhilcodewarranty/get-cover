const express = require("express");

const router = express.Router();

const orderController = require("../controller/order");

const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

// POST routes
router.post('/createOrder', [verifyToken], orderController.createOrder1); // create order

router.post('/editOrderDetail/:orderId', [verifyToken], orderController.editOrderDetail); // edit order detail

router.post('/archiveOrder/:orderId', [verifyToken], orderController.archiveOrder); // archive order

router.post('/processOrder/:orderId', [verifyToken], orderController.processOrder); // process order

router.post('/checkFileValidation', [verifyToken], orderController.checkFileValidation); // check file validation

router.post('/checkMultipleFileValidation', [verifyToken], orderController.checkMultipleFileValidation); // check multiple file validation

router.post('/getAllOrders', [verifyToken], orderController.getAllOrders); // get all orders

router.post('/editFileCase', [verifyToken], orderController.editFileCase); // edit file case

router.post('/getArchieveOrder', [verifyToken], orderController.getAllArchieveOrders); // get archived orders

router.post('/getPendingAmount/:orderId', [verifyToken], orderController.getPendingAmount); // get pending amount for an order

router.post('/getOrderContract/:orderId', [verifyToken], orderController.getOrderContract); // get order contract

router.post('/getOrderPdf/:orderId', [verifyToken], orderController.getOrderPdf); // get order PDF

router.post('/getServicerInOrders', [verifyToken], orderController.getServicerInOrders); // get servicer in orders

router.post("/getDealerResellers", [verifyToken], orderController.getDealerResellers); // get dealer resellers

router.post('/getServicerByOrderId/:orderId', [verifyToken], orderController.getServicerByOrderId); // get servicer by order ID

router.post('/checkPurchaseOrder', [verifyToken], orderController.checkPurchaseOrder); // check purchase order

router.post('/getDashboardData', [verifyToken], orderController.getDashboardData); // get dashboard data

router.post('/getResellerByDealerAndCustomer', [verifyToken], orderController.getResellerByDealerAndCustomer); // get reseller by dealer and customer

router.post('/getCustomerInOrder', [verifyToken], orderController.getCustomerInOrder); // get customer in order

router.post('/getCategoryAndPriceBooks/:dealerId', [verifyToken], orderController.getCategoryAndPriceBooks); // get category and price books by dealer ID

router.post('/getPriceBooksInOrder/:dealerId', [verifyToken], orderController.getPriceBooksInOrder); // get price books in order by dealer ID

router.post('/cronJobStatusWithDate', orderController.cronJobStatusWithDate); // cron job status with date

// PUT routes
router.put('/updateServicerByOrder/:orderId', [verifyToken], orderController.updateServicerByOrder); // update servicer by order ID

// GET routes
router.get('/getOrderById/:orderId', [verifyToken], orderController.getSingleOrder); // get order by ID

router.get('/markAsPaid/:orderId', [verifyToken], orderController.markAsPaid); // mark order as paid

router.get('/getServiceCoverage/:dealerId', [verifyToken], orderController.getServiceCoverage); // get service coverage by dealer ID

router.get('/cronJobStatus', orderController.cronJobStatus); // cron job status

router.get('/generateHtmltopdf/:orderId', [verifyToken], orderController.generateHtmltopdf); // generate HTML to PDF by order ID

router.get('/reportingDataCreation', [verifyToken], orderController.reportingDataCreation); // reporting data creation

router.get('/reportingDataReCreation', [verifyToken], orderController.reportingDataReCreation); // reporting data re-creation

module.exports = router;
