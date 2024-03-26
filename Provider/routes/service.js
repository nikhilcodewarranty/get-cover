const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const servicerAdminController = require("../controller/serviceAdminController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post("/createServiceProvider",validator('create_servicer_validation'),[verifyToken],servicerAdminController.createServiceProvider)
router.post("/addServicerUser/:servicerId",[verifyToken],servicerAdminController.addServicerUser)
router.put("/approveServicer/:servicerId",[verifyToken],servicerAdminController.approveServicer)
router.put("/editServicerDetail/:servicerId",[verifyToken],servicerAdminController.editServicerDetail)
router.put("/updateStatus/:servicerId",[verifyToken],servicerAdminController.updateStatus)
router.post("/register", servicerAdminController.registerServiceProvider)
router.get("/serviceProvider", servicerAdminController.getAllServiceProviders);
router.post("/getSerivicerUsers/:servicerId", servicerAdminController.getSerivicerUsers);
router.post("/servicers/:status", [verifyToken], servicerAdminController.getServicer); //get all dealers
router.get("/getServiceProviderById/:servicerId", [verifyToken], servicerAdminController.getServiceProviderById); //get all dealers
router.delete("/rejectServicer/:servicerId", [verifyToken], servicerAdminController.rejectServicer); //get all dealers

router.get("/serviceProvider/create-serviceProvider", servicerAdminController.createServiceProvider);
router.post("/getServicerClaims/:servicerId", [verifyToken], servicerAdminController.getServicerClaims);

router.post("/createRelationWithDealer/:servicerId",[verifyToken],servicerAdminController.createDeleteRelation)
router.post("/getServicerDealers/:servicerId",[verifyToken],servicerAdminController.getServicerDealers)
router.get("/getDealerList/:servicerId",[verifyToken],servicerAdminController.getDealerList)


module.exports = router;
