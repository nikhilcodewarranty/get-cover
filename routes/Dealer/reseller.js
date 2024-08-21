
const express = require("express");
const router = express.Router();
const resellerController = require("../../controllers/Dealer/resellerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller) // Create a new reseller
router.post('/getAllResellers', [verifyToken], resellerController.getAllResellers) // Get all resellers
router.post("/getResellerServicers/:resellerId", [verifyToken], resellerController.getResellerServicers) // Get all servicers for a reseller by reseller ID
router.post("/getResellerByDealerId/:dealerId", [verifyToken], resellerController.getResellerByDealerId) // Get a reseller by dealer ID
router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser) // Add a new user to a reseller
router.post("/getResselerByCustomer/:customerId", [verifyToken], resellerController.getResselerByCustomer) // Get a reseller by customer ID
router.post("/changeResellerStatus/:resellerId", [verifyToken], resellerController.changeResellerStatus) // Change the status of a reseller
router.post("/getResellerClaims/:resellerId", [verifyToken], resellerController.getResellerClaims) // Get claims for a reseller by reseller ID
router.get("/getResellerById/:resellerId", [verifyToken], resellerController.getResellerById) // Get a reseller by reseller ID
router.get("/getDealerByReseller/:resellerId", [verifyToken], resellerController.getDealerByReseller) // Get a dealer by reseller ID
router.post("/getResellerPriceBook/:resellerId", [verifyToken], resellerController.getResellerPriceBook) // Get the price book for a reseller by reseller ID
router.post("/getResellerUsers/:resellerId", [verifyToken], resellerController.getResellerUsers) // Get all users for a reseller by reseller ID
router.post("/resellerOrders/:resellerId", [verifyToken], resellerController.getResellerOrders) // Get all orders for a reseller by reseller ID
router.post("/getResellerContract/:resellerId", [verifyToken], resellerController.getResellerContract) // Get the contract for a reseller by reseller ID
router.put("/editResellers/:resellerId", [verifyToken], resellerController.editResellers) // Edit a reseller by reseller ID


module.exports = router; 
