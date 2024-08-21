const express = require("express");
const router = express.Router();
const validator = require('../config/validation'); // validation handler as a middleware
const servicerAdminController = require("../controller/serviceAdminController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const supportingFunction = require('../../config/supportingFunction');

// POST routes
router.post("/createServiceProvider", validator('create_servicer_validation'), [verifyToken], servicerAdminController.createServiceProvider); // create service provider
router.post("/addServicerUser/:servicerId", [verifyToken], servicerAdminController.addServicerUser); // add servicer user
router.post("/register", servicerAdminController.registerServiceProvider); // register service provider
router.post("/getSerivicerUsers/:servicerId", servicerAdminController.getSerivicerUsers); // get servicer users
router.post("/servicers/:status", [verifyToken], servicerAdminController.getServicer); // get all dealers by status
router.post("/getPaidUnpaidClaims/:servicerId", [verifyToken], servicerAdminController.paidUnpaidClaim); // get paid and unpaid claims by servicer ID
router.post("/paidUnpaidClaim", [verifyToken], servicerAdminController.paidUnpaid); // get paid and unpaid claims
router.post("/getServicerClaims/:servicerId", [verifyToken], servicerAdminController.getServicerClaims); // get servicer claims
router.post("/createRelationWithDealer/:servicerId", [verifyToken], servicerAdminController.createDeleteRelation); // create relation with dealer
router.post("/getServicerDealers/:servicerId", [verifyToken], servicerAdminController.getServicerDealers); // get servicer dealers
router.post("/getServicerDealers1/:servicerId", [verifyToken], servicerAdminController.getServicerDealers1); // get servicer dealers (alternative)
// PUT routes
router.put("/approveServicer/:servicerId", [verifyToken], servicerAdminController.approveServicer); // approve servicer
router.put("/editServicerDetail/:servicerId", [verifyToken], servicerAdminController.editServicerDetail); // edit servicer detail
router.put("/updateStatus/:servicerId", [verifyToken], servicerAdminController.updateStatus); // update status
// GET routes
router.get("/serviceProvider", servicerAdminController.getAllServiceProviders); // get all service providers
router.get("/getServiceProviderById/:servicerId", [verifyToken], supportingFunction.checkObjectId, servicerAdminController.getServiceProviderById); // get service provider by ID
router.get("/serviceProvider/create-serviceProvider", servicerAdminController.createServiceProvider); // create service provider page
router.get("/getDealerList/:servicerId", [verifyToken], supportingFunction.checkObjectId, servicerAdminController.getDealerList); // get dealer list by servicer ID
// DELETE routes
router.delete("/rejectServicer/:servicerId", [verifyToken], supportingFunction.checkObjectId, servicerAdminController.rejectServicer); // reject servicer

module.exports = router;
