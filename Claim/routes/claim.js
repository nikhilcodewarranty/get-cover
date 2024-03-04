const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");
const { verifyToken } = require("../../middleware/auth");
router.post("/searchClaim", [verifyToken],claimController.searchClaim);
router.post("/uploadReceipt", [verifyToken],claimController.uploadReceipt);
router.post("/createClaim",[verifyToken],claimController.addClaim)
router.post("/getAllClaims",[verifyToken],claimController.getAllClaims)
router.put("/editClaim/:claimId",[verifyToken],claimController.editClaim)
router.put("/editClaimStatus/:claimId",[verifyToken],claimController.editClaimStatus)
router.get("/getContractById/:contractId",[verifyToken],claimController.getContractById)


module.exports = router;
 