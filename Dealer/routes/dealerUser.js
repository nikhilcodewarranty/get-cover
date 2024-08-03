const express = require("express");

const router = express.Router();

const dealerUserController = require("../controller/dealerUserController");

const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

const validator = require('../config/validation');

// POST routes
router.post('/getDealerUsers', [verifyToken], dealerUserController.getDealerUsers); // get dealer users

router.post('/createOrder', [verifyToken], dealerUserController.createOrder); // create order

router.post('/editOrderDetail/:orderId', [verifyToken], dealerUserController.editOrderDetail); // edit order detail

router.post('/getPriceBooks', [verifyToken], dealerUserController.getPriceBooks); // get price books

router.post('/createDealerPriceBook', [verifyToken], dealerUserController.createDealerPriceBook); // create dealer price book

router.post('/getAllPriceBooksByFilter', [verifyToken], dealerUserController.getAllPriceBooksByFilter); // get all price books by filter

router.post('/createCustomer', [verifyToken], validator('create_customer'), dealerUserController.createCustomer); // create customer

router.post('/getDealerCustomers', [verifyToken], dealerUserController.getDealerCustomers); // get dealer customers

router.post("/getResellerPriceBook/:resellerId", [verifyToken], dealerUserController.getResellerPriceBook); // get reseller price book

router.post('/getCustomerInOrder', [verifyToken], dealerUserController.getCustomerInOrder); // get customer in order

router.post('/getServicerInOrders', [verifyToken], dealerUserController.getServicerInOrders); // get servicer in orders

router.post('/getDealerResellers', [verifyToken], dealerUserController.getDealerResellers); // get dealer resellers

router.post('/getDealerResellersInOrder', [verifyToken], dealerUserController.getDealerResellersInOrder); // get dealer resellers in order

router.post('/getCustomerOrders/:customerId', [verifyToken], dealerUserController.customerOrders); // get customer orders

router.post('/getResellerOrders/:resellerId', [verifyToken], dealerUserController.getResellerOrders); // get reseller orders

router.post("/getResellerUsers/:resellerId", [verifyToken], dealerUserController.getResellerUsers); // get reseller users

router.post("/getResellerServicers/:resellerId", [verifyToken], dealerUserController.getResellerServicers); // get reseller servicers

router.post("/getResellerCustomers/:resellerId", [verifyToken], dealerUserController.getResellerCustomers); // get reseller customers

router.post('/createReseller', [verifyToken], dealerUserController.createReseller); // create reseller

router.post('/getCategoryAndPriceBooks', [verifyToken], dealerUserController.getCategoryAndPriceBooks); // get category and price books

router.post('/getDealerServicers', [verifyToken], dealerUserController.getDealerServicers); // get dealer servicers

router.post('/getDealerContracts', [verifyToken], dealerUserController.getAllContracts); // get dealer contracts

router.post('/createDeleteRelation', [verifyToken], dealerUserController.createDeleteRelation); // create or delete relation

router.post('/getDealerOrders', [verifyToken], dealerUserController.getDealerOrders); // get dealer orders

router.post('/getDealerArchievedOrders', [verifyToken], dealerUserController.getDealerArchievedOrders); // get dealer archived orders

router.post("/createClaim", [verifyToken], dealerUserController.addClaim); // create claim

router.post("/getAllClaims", [verifyToken], dealerUserController.getAllClaims); // get all claims

router.post("/saleReporting", [verifyToken], dealerUserController.saleReporting); // sale reporting

router.post("/claimReporting", [verifyToken], dealerUserController.claimReporting); // claim reporting

router.post("/saleReportinDropDown", [verifyToken], dealerUserController.saleReportinDropDown); // sale reporting dropdown

router.post("/claimReportinDropdown", [verifyToken], dealerUserController.claimReportinDropdown); // claim reporting dropdown

// GET routes
router.get('/getDashboardData', [verifyToken], dealerUserController.getDashboardData); // get dashboard data

router.get('/getDealerPriceBookById/:dealerPriceBookId', [verifyToken], dealerUserController.getDealerPriceBookById); // get dealer price book by ID

router.get('/getServicersList', [verifyToken], dealerUserController.getServicersList); // get servicers list

router.get("/getDashboardGraph", [verifyToken], dealerUserController.getDashboardGraph); // get dashboard graph

router.get("/getDashboardInfo", [verifyToken], dealerUserController.getDashboardInfo); // get dashboard info

// PUT routes
router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], dealerUserController.statusUpdate); // update dealer price book

module.exports = router;
