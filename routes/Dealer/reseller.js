
const express = require("express");
const router = express.Router();
const resellerController = require("../../controllers/Dealer/resellerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../../middleware/validator');
const supportingFunction = require('../../config/supportingFunction')

router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller) // Create a new reseller
router.post('/getAllResellers', [verifyToken], resellerController.getAllResellers) // Get all resellers
router.post("/getResellerServicers/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerServicers) // Get all servicers for a reseller by reseller ID
router.post("/getResellerByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerByDealerId) // Get a reseller by dealer ID
router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser) // Add a new user to a reseller
router.post("/getResselerByCustomer/:customerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResselerByCustomer) // Get a reseller by customer ID
router.post("/changeResellerStatus/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.changeResellerStatus) // Change the status of a reseller
router.post("/getResellerClaims/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerClaims) // Get claims for a reseller by reseller ID
router.get("/getResellerById/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerById) // Get a reseller by reseller ID
router.get("/getDealerByReseller/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getDealerByReseller) // Get a dealer by reseller ID
router.post("/getResellerPriceBook/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerPriceBook) // Get the price book for a reseller by reseller ID
router.post("/getResellerUsers/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerUsers) // Get all users for a reseller by reseller ID
router.post("/resellerOrders/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerOrders) // Get all orders for a reseller by reseller ID
router.post("/getResellerContract/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.getResellerContract) // Get the contract for a reseller by reseller ID
router.put("/editResellers/:resellerId", [verifyToken], supportingFunction.checkObjectId, resellerController.editResellers) // Edit a reseller by reseller ID


module.exports = router; 