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
router.get("/getUserId/:userId", [verifyToken], servicerController.getUserId)
router.post("/createRelationWithDealer", [verifyToken], servicerController.createDeleteRelation)
router.post("/saleReporting", [verifyToken], servicerController.saleReporting)
router.post("/claimReporting", [verifyToken], servicerController.claimReporting)


module.exports = router;
