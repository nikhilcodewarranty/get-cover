const express = require("express"); // Express framework
const router = express.Router(); // Express router
const claimController = require("../controller/claim"); // claim controller
const { verifyToken } = require("../../middleware/auth"); // authentication with JWT as middleware


router.post("/searchClaim", [verifyToken], claimController.searchClaim); // search claim

router.post("/s3Bucket", claimController.s3Bucket); // s3 bucket operations

router.post("/saveBulkClaim", [verifyToken], claimController.saveBulkClaim); // save bulk claim

router.post("/getUnpaidAmount", [verifyToken], claimController.getUnpaidAmount); // get unpaid amount

router.post("/uploadReceipt", [verifyToken], claimController.uploadReceipt); // upload receipt

router.post("/sendMessages/:claimId", [verifyToken], claimController.sendMessages); // send messages for a claim

router.post("/uploadCommentImage", [verifyToken], claimController.uploadCommentImage); // upload comment image

router.post("/createClaim", [verifyToken], claimController.addClaim); // create a claim

router.post("/getCoverageType/:contractId", [verifyToken], claimController.getCoverageType); // get coverage type by contract ID

router.post("/getAllClaims", [verifyToken], claimController.getAllClaims); // get all claims

router.post("/getClaims", [verifyToken], claimController.getClaims); // get claims

router.put("/editClaim/:claimId", [verifyToken], claimController.editClaim); // edit claim by ID

router.put("/editClaimType/:claimId", [verifyToken], claimController.editClaimType); // edit claim type by ID

router.put("/editClaimStatus/:claimId", [verifyToken], claimController.editClaimStatus); // edit claim status by ID

router.put("/editServicer/:claimId", [verifyToken], claimController.editServicer); // edit servicer for a claim by ID

router.get("/getContractById/:contractId", [verifyToken], claimController.getContractById); // get contract by ID

router.get("/statusClaim", claimController.statusClaim); // get claim status

router.get("/getMaxClaimAmount/:contractId", [verifyToken], claimController.getMaxClaimAmount); // get max claim amount by contract ID

router.get("/getMessages/:claimId", [verifyToken], claimController.getMessages); // get messages for a claim



module.exports = router;
