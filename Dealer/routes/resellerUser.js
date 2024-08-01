const express = require("express");
const router = express.Router();
const resellerController = require("../controller/resellerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

// POST routes
router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller); // create a new reseller

router.post('/getAllResellers', [verifyToken], resellerController.getAllResellers); // get all resellers

router.post("/getResellerServicers", [verifyToken], resellerController.getResellerServicers); // get reseller servicers

router.post("/getResellerByDealerId/:dealerId", [verifyToken], resellerController.getResellerByDealerId); // get reseller by dealer ID

router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser); // add a user to a reseller

router.post("/getResselerByCustomer/:customerId", [verifyToken], resellerController.getResselerByCustomer); // get reseller by customer ID

router.post("/changeResellerStatus", [verifyToken], resellerController.changeResellerStatus); // change reseller status

router.post("/getResellerClaims", [verifyToken], resellerController.getResellerClaims); // get reseller claims

router.post("/getResellerCustomers", [verifyToken], resellerController.getResellerCustomers); // get reseller customers

router.post("/create-customer", [verifyToken], validator('create_customer'), resellerController.createCustomer); // create a new customer

router.post('/getCustomerInOrder', [verifyToken], resellerController.getCustomerInOrder); // get customer in an order

router.post('/getServicerInOrders', [verifyToken], resellerController.getServicerInOrders); // get servicer in orders

router.post('/createOrder', [verifyToken], resellerController.createOrder); // create a new order

router.post('/getArchieveOrder', [verifyToken], resellerController.getAllArchieveOrders); // get all archived orders

router.post("/getResellerPriceBook", [verifyToken], resellerController.getResellerPriceBook); // get reseller price book

router.post("/getResellerUsers", [verifyToken], resellerController.getResellerUsers); // get reseller users

router.post("/getResellerDetails", [verifyToken], resellerController.getResellerDetails); // get reseller details

router.post("/resellerOrders", [verifyToken], resellerController.getResellerOrders); // get reseller orders

router.post("/getResellerContract", [verifyToken], resellerController.getResellerContract); // get reseller contract

router.post('/getCategoryAndPriceBooks', [verifyToken], resellerController.getCategoryAndPriceBooks); // get category and price books

router.post('/editOrderDetail/:orderId', [verifyToken], resellerController.editOrderDetail); // edit order details

// POST routes continued
router.post('/saleReporting', [verifyToken], resellerController.saleReporting); // sale reporting

router.post('/claimReporting', [verifyToken], resellerController.claimReporting); // claim reporting

router.post('/saleReportinDropDown', [verifyToken], resellerController.saleReportinDropDown); // sale reporting dropdown

router.post('/claimReportinDropdown', [verifyToken], resellerController.claimReportinDropdown); // claim reporting dropdown

// GET routes
router.get("/getResellerById", [verifyToken], resellerController.getResellerById); // get reseller by ID

router.get("/getDashboardData", [verifyToken], resellerController.getDashboardData); // get dashboard data

router.get("/getDealerByReseller", [verifyToken], resellerController.getDealerByReseller); // get dealer by reseller

router.get('/getDashboardGraph', [verifyToken], resellerController.getDashboardGraph); // get dashboard graph

router.get('/getDashboardInfo', [verifyToken], resellerController.getDashboardInfo); // get dashboard info

// PUT routes
router.put("/editResellers", [verifyToken], resellerController.editResellers); // edit reseller details



module.exports = router;
