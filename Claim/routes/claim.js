const express = require("express"); // Express framework
const router = express.Router(); // Express router
const claimController = require("../controller/claim"); // claim controller
const claimGetController = require("../controller/claimGet"); // claim get functions controller
const { verifyToken } = require("../../middleware/auth"); // authentication with JWT as middleware

// POST routes
router.post("/searchClaim", [verifyToken], claimController.searchClaim); // search claim
router.post("/s3Bucket", claimController.s3Bucket); // s3 bucket operations
router.post("/saveBulkClaim", [verifyToken], claimController.saveBulkClaim); // save bulk claim
router.post("/uploadReceipt", [verifyToken], claimController.uploadReceipt); // upload receipt
router.post("/sendMessages/:claimId", [verifyToken], claimController.sendMessages); // send messages for a claim
router.post("/uploadCommentImage", [verifyToken], claimController.uploadCommentImage); // upload comment image
router.post("/createClaim", [verifyToken], claimController.addClaim); // create a claim
router.put("/editClaim/:claimId", [verifyToken], claimController.editClaim); // edit claim by ID
router.put("/editClaimType/:claimId", [verifyToken], claimController.editClaimType); // edit claim type by ID
router.put("/editClaimStatus/:claimId", [verifyToken], claimController.editClaimStatus); // edit claim status by ID
router.put("/editServicer/:claimId", [verifyToken], claimController.editServicer); // edit servicer for a claim by ID
router.get("/statusClaim", claimController.statusClaim); // get claim status

router.post("/getUnpaidAmount", [verifyToken], claimGetController.getUnpaidAmount); // get unpaid amount
router.post("/getCoverageType/:contractId", [verifyToken], claimGetController.getCoverageType); // get coverage type by contract ID
router.post("/getAllClaims", [verifyToken], claimGetController.getAllClaims); // get all claims
router.post("/getClaims", [verifyToken], claimGetController.getClaims); // get claims
router.get("/getContractById/:contractId", [verifyToken], claimGetController.getContractById); // get contract by ID
router.get("/getMaxClaimAmount/:contractId", [verifyToken], claimGetController.getMaxClaimAmount); // get max claim amount by contract ID
router.get("/getMessages/:claimId", [verifyToken], claimGetController.getMessages); // get messages for a claim

module.exports = router;
