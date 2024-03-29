const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");
const { verifyToken } = require("../../middleware/auth");
router.post("/searchClaim", [verifyToken],claimController.searchClaim);
router.post("/saveBulkClaim", [verifyToken],claimController.saveBulkClaim);
router.post("/uploadReceipt", [verifyToken],claimController.uploadReceipt);
router.post("/sendMessages/:claimId", [verifyToken],claimController.sendMessages);
router.get("/getMessages/:claimId", [verifyToken],claimController.getMessages);
router.post("/uploadCommentImage", [verifyToken],claimController.uploadCommentImage);
router.post("/createClaim",[verifyToken],claimController.addClaim)
router.post("/getAllClaims",[verifyToken],claimController.getAllClaims)
router.put("/editClaim/:claimId",[verifyToken],claimController.editClaim)
router.put("/editClaimStatus/:claimId",[verifyToken],claimController.editClaimStatus)
router.put("/editServicer/:claimId",[verifyToken],claimController.editServicer)
router.get("/getContractById/:contractId",[verifyToken],claimController.getContractById)
router.get("/statusClaim",claimController.statusClaim)
// router.post("/bulKDataUpload",[verifyToken],claimController.saveBulkData)
router.get("/getMaxClaimAmount/:contractId",[verifyToken],claimController.getMaxClaimAmount)

module.exports = router;
 