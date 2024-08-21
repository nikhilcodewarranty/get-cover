const express = require("express");
const router = express.Router();
const dealerUserController = require("../../controllers/Dealer/dealerUserController"); // dealer user controller
const dealerUserSupportingController = require("../../controllers/Dealer/dealerUserSupporting"); // dealer user get functions controller
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/createOrder', [verifyToken], dealerUserController.createOrder); // create order
router.post('/editOrderDetail/:orderId', [verifyToken], dealerUserController.editOrderDetail); // edit order detail
router.post('/createDealerPriceBook', [verifyToken], dealerUserController.createDealerPriceBook); // create dealer price book
router.post('/createCustomer', [verifyToken], validator('create_customer'), dealerUserController.createCustomer); // create customer
router.post('/getCustomerOrders/:customerId', [verifyToken], dealerUserController.customerOrders); // get customer orders
router.post('/createReseller', [verifyToken], dealerUserController.createReseller); // create reseller
router.post('/createDeleteRelation', [verifyToken], dealerUserController.createDeleteRelation); // create or delete relation
router.post("/createClaim", [verifyToken], dealerUserController.addClaim); // create claim
router.post("/saleReporting", [verifyToken], dealerUserController.saleReporting); // sale reporting
router.post("/claimReporting", [verifyToken], dealerUserController.claimReporting); // claim reporting
router.post("/saleReportinDropDown", [verifyToken], dealerUserController.saleReportinDropDown); // sale reporting dropdown
router.post("/claimReportinDropdown", [verifyToken], dealerUserController.claimReportinDropdown); // claim reporting dropdown
router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], dealerUserController.statusUpdate); // update dealer price book

router.post('/getDealerUsers', [verifyToken], dealerUserSupportingController.getDealerUsers); // get dealer users
router.post('/getPriceBooks', [verifyToken], dealerUserSupportingController.getPriceBooks); // get price books
router.post('/getAllPriceBooksByFilter', [verifyToken], dealerUserSupportingController.getAllPriceBooksByFilter); // get all price books by filter
router.post('/getDealerCustomers', [verifyToken], dealerUserSupportingController.getDealerCustomers); // get dealer customers
router.post("/getResellerPriceBook/:resellerId", [verifyToken], dealerUserSupportingController.getResellerPriceBook); // get reseller price book
router.post('/getCustomerInOrder', [verifyToken], dealerUserSupportingController.getCustomerInOrder); // get customer in order
router.post('/getServicerInOrders', [verifyToken], dealerUserSupportingController.getServicerInOrders); // get servicer in orders
router.post('/getDealerResellers', [verifyToken], dealerUserSupportingController.getDealerResellers); // get dealer resellers
router.post('/getDealerResellersInOrder', [verifyToken], dealerUserSupportingController.getDealerResellersInOrder); // get dealer resellers in order
router.post('/getResellerOrders/:resellerId', [verifyToken], dealerUserSupportingController.getResellerOrders); // get reseller orders
router.post("/getResellerUsers/:resellerId", [verifyToken], dealerUserSupportingController.getResellerUsers); // get reseller users
router.post("/getResellerServicers/:resellerId", [verifyToken], dealerUserSupportingController.getResellerServicers); // get reseller servicers
router.post("/getResellerCustomers/:resellerId", [verifyToken], dealerUserSupportingController.getResellerCustomers); // get reseller customers
router.post('/getCategoryAndPriceBooks', [verifyToken], dealerUserSupportingController.getCategoryAndPriceBooks); // get category and price books
router.post('/getDealerServicers', [verifyToken], dealerUserSupportingController.getDealerServicers); // get dealer servicers
router.post('/getDealerContracts', [verifyToken], dealerUserSupportingController.getAllContracts); // get dealer contracts
router.post('/getDealerOrders', [verifyToken], dealerUserSupportingController.getDealerOrders); // get dealer orders
router.post('/getDealerArchievedOrders', [verifyToken], dealerUserSupportingController.getDealerArchievedOrders); // get dealer archived orders
router.post("/getAllClaims", [verifyToken], dealerUserSupportingController.getAllClaims); // get all claims
router.get('/getDashboardData', [verifyToken], dealerUserSupportingController.getDashboardData); // get dashboard data
router.get('/getDealerPriceBookById/:dealerPriceBookId', [verifyToken], dealerUserSupportingController.getDealerPriceBookById); // get dealer price book by ID
router.get('/getServicersList', [verifyToken], dealerUserSupportingController.getServicersList); // get servicers list
router.get("/getDashboardGraph", [verifyToken], dealerUserSupportingController.getDashboardGraph); // get dashboard graph
router.get("/getDashboardInfo", [verifyToken], dealerUserSupportingController.getDashboardInfo); // get dashboard info

module.exports = router;
