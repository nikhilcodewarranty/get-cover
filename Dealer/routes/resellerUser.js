const express = require("express");
const router = express.Router();
const resellerController = require("../controller/resellerUserController");
const resellerUserGetController = require("../controller/resellerUserGet");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');
const supportingFunction = require('../../config/supportingFunction')

router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller); // create reseller
router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser); // add reseller user
router.post("/changeResellerStatus", [verifyToken], resellerController.changeResellerStatus); // change reseller status
router.post("/create-customer", [verifyToken], validator('create_customer'), [verifyToken], resellerController.createCustomer); // create customer
router.post('/createOrder', [verifyToken], resellerController.createOrder); // create order
router.post('/editOrderDetail/:orderId', [verifyToken], supportingFunction.checkObjectId, resellerController.editOrderDetail); // edit order detail
router.post('/saleReporting', [verifyToken], resellerController.saleReporting); // sale reporting
router.post('/claimReporting', [verifyToken], resellerController.claimReporting); // claim reporting
router.post('/saleReportinDropDown', [verifyToken], resellerController.saleReportinDropDown); // sale reporting dropdown
router.post('/claimReportinDropdown', [verifyToken], resellerController.claimReportinDropdown); // claim reporting dropdown
router.put("/editResellers", [verifyToken], resellerController.editResellers); // edit resellers


router.post('/getAllResellers', [verifyToken], resellerUserGetController.getAllResellers); // get all resellers
router.post("/getResellerServicers", [verifyToken], resellerUserGetController.getResellerServicers); // get reseller servicers
router.post("/getResellerByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, resellerUserGetController.getResellerByDealerId); // get reseller by dealer ID
router.post("/getResselerByCustomer/:customerId", [verifyToken], supportingFunction.checkObjectId, resellerUserGetController.getResselerByCustomer); // get reseller by customer ID
router.post("/getResellerClaims", [verifyToken], resellerUserGetController.getResellerClaims); // get reseller claims
router.post("/getResellerCustomers", [verifyToken], resellerUserGetController.getResellerCustomers); // get reseller customers
router.post('/getCustomerInOrder', [verifyToken], resellerUserGetController.getCustomerInOrder); // get customer in order
router.post('/getServicerInOrders', [verifyToken], resellerUserGetController.getServicerInOrders); // get servicer in orders
router.post('/getArchieveOrder', [verifyToken], resellerUserGetController.getAllArchieveOrders); // get archive order 
router.post("/getResellerPriceBook", [verifyToken], resellerUserGetController.getResellerPriceBook); // get reseller price book
router.post("/getResellerUsers", [verifyToken], resellerUserGetController.getResellerUsers); // get reseller users
router.post("/getResellerDetails", [verifyToken], resellerUserGetController.getResellerDetails); // get reseller details
router.post("/resellerOrders", [verifyToken], resellerUserGetController.getResellerOrders); // get reseller orders
router.post("/getResellerContract", [verifyToken], resellerUserGetController.getResellerContract); // get reseller contract
router.post('/getCategoryAndPriceBooks', [verifyToken], resellerUserGetController.getCategoryAndPriceBooks); // get category and price books
router.get("/getResellerById", [verifyToken], resellerUserGetController.getResellerById); // get reseller by ID
router.get("/getDashboardData", [verifyToken], resellerUserGetController.getDashboardData); // get dashboard data
router.get("/getDealerByReseller", [verifyToken], resellerUserGetController.getDealerByReseller); // get dealer by reseller
router.get('/getDashboardGraph', [verifyToken], resellerUserGetController.getDashboardGraph); // get dashboard graph
router.get('/getDashboardInfo', [verifyToken], resellerUserGetController.getDashboardInfo); // get dashboard info





module.exports = router;






