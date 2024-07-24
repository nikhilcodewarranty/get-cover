const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const servicerController = require("../controller/servicerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware


router.post("/getServicerUsers", [verifyToken], servicerController.getServicerUsers)
router.post("/addServicerUser", [verifyToken], servicerController.addServicerUser)
router.post("/getServicerDealers", [verifyToken], servicerController.getServicerDealers)
router.put("/changePrimaryUser", [verifyToken], servicerController.changePrimaryUser)
router.put("/editUserDetail/:userId", [verifyToken], servicerController.editUserDetail)
router.get("/getServicerDetail", [verifyToken], servicerController.getServicerDetail)
router.get("/getDashboardData", [verifyToken], servicerController.getDashboardData)
router.get("/getDashboardGraph", [verifyToken], servicerController.getDashboardGraph)
router.get("/getDashboardInfo", [verifyToken], servicerController.getDashboardInfo)
router.get("/getUserId/:userId", [verifyToken], servicerController.getUserId)
router.post("/createRelationWithDealer", [verifyToken], servicerController.createDeleteRelation)
router.post("/saleReporting", [verifyToken], servicerController.saleReporting)
router.post("/claimReporting", [verifyToken], servicerController.claimReporting)
<<<<<<< HEAD
router.get("/getDashboardInfo", [verifyToken], servicerController.getDashboardInfo)
=======
router.post("/claimReportinDropdown", [verifyToken], servicerController.claimReportinDropdown)
>>>>>>> d388f6ccbb9fc4c80521b83a8cf819e84373b413


module.exports = router;
