const express = require("express"); // Express framework
const router = express.Router(); // Express router
const claimController = require("../../controllers/Claim/claim"); // claim controller
const claimExportController = require("../../controllers/Claim/claimExports"); // claim controller
const claimGetController = require("../../controllers/Claim/claimGet"); // claim get functions controller
const { verifyToken } = require("../../middleware/auth"); // authentication with JWT as middleware
const supportingFunction = require("../../config/supportingFunction");

router.post("/searchClaim", [verifyToken], claimController.searchClaim); // search claim
router.post("/s3Bucket", claimController.s3Bucket); // s3 bucket operations
router.post("/saveBulkClaim", [verifyToken], claimController.saveBulkClaim); // save bulk claim
router.post("/uploadReceipt", [verifyToken], claimController.uploadReceipt); // upload receipt
router.post("/uploadPrePostImages/:claimId", [verifyToken], claimController.uploadPrePostImages); // upload receipt
router.post("/deletePrePostImages/:claimId", [verifyToken], claimController.deletePrePostImages); // upload receipt

router.post("/sendMessages/:claimId", [verifyToken], claimController.sendMessages); // send messages for a add
router.post("/uploadCommentImage", [verifyToken], claimController.uploadCommentImage); // upload comment image
router.post("/createClaim", [verifyToken], claimController.addClaim); // create a claim
router.post("/getUnpaidAmount", [verifyToken], claimGetController.getUnpaidAmount); // get unpaid amount
router.post("/getCoverageType/:contractId", [verifyToken], claimGetController.getCoverageType); // get coverage type by contract ID
router.post("/getAllClaims", [verifyToken], claimGetController.getAllClaims1); // get all claims
router.post("/getClaims", [verifyToken], claimGetController.getClaims); // get claims
//PUT Routes
router.put("/editClaim/:claimId", [verifyToken], claimController.editClaim); // edit claim by ID
router.put("/editClaimType/:claimId", [verifyToken], claimController.editClaimType); // edit claim type by ID
router.put("/editClaimStatus/:claimId", [verifyToken], claimController.editClaimStatus); // edit claim status by ID
router.put("/editServicer/:claimId", [verifyToken], claimController.editServicer); // edit servicer for a claim by ID
router.get("/sendStaticEmail", claimController.sendStaticEmail); // edit servicer for a claim by ID


//GET Routes
router.get("/statusClaim", claimController.statusClaim); // get claim status
router.get("/getContractById/:contractId", [verifyToken], supportingFunction.checkObjectId, claimGetController.getContractById); // get contract by ID
router.get("/getMaxClaimAmount/:contractId", claimGetController.getMaxClaimAmount); // get max claim amount by contract ID
router.get("/getMessages/:claimId", [verifyToken], claimGetController.getMessages); // get messages for a claim
router.get("/getcustomerDetail/:claimId", [verifyToken], claimGetController.getcustomerDetail); // get messages for a claim
router.post("/checkCoverageTypeDate", claimGetController.checkCoverageTypeDate); // check coverage type date  in edit claim
router.post("/checkCoverageTypeDateInContract", [verifyToken], claimGetController.checkCoverageTypeDateInContract); // check coverage type date  in add claim option 
router.get("/checkClaimAmount/:claimId", claimGetController.checkClaimAmount); // check claim amount in edit claim and change coverage type
router.get("/updateContracts", claimGetController.updateContracts); // check claim amount in edit claim and change coverage type
router.post("/checkClaimThreshHold/:claimId", [verifyToken], claimGetController.checkClaimThreshHold); // check claim amount in edit claim and change coverage type
router.get("/getClaimById/:claimId", [verifyToken], claimGetController.getClaimById); // check claim amount in edit claim and change coverage type
router.post("/getTrackingDetail/:claimId", [verifyToken], claimGetController.getTrackingDetail); // check claim amount in edit claim and change coverage type
router.get("/updateClaimDate", claimController.updateClaimDate); // check claim amount in edit claim and change coverage type
router.get("/checkNumberOfCertainPeriod", claimController.checkNumberOfCertainPeriod); // check claim amount in edit claim and change coverage type
router.post("/getUsersForRole", [verifyToken], claimGetController.getUsersForRole); //get user for role 


router.post("/exportDataForClaim", [verifyToken], claimExportController.exportDataForClaim); // check claim amount in edit claim and change coverage type
// router.post("/getClaimDetails", [verifyToken], claimExportController.getClaimDetails); // check claim amount in edit claim and change coverage type
router.post("/paidUnpaidClaimReporting", [verifyToken], claimExportController.paidUnpaidClaimReporting); // check claim amount in edit claim and change coverage type
router.post("/getClaimReportings", [verifyToken], claimExportController.getClaimReportings); // check claim amount in edit claim and change coverage type
router.get("/getClaimReporting/:reportingId", [verifyToken], claimExportController.getClaimReporting); // check claim amount in edit claim and change coverage type
router.get("/updateReportingDownloadTime/:reportingId", [verifyToken], claimExportController.updateReportingDownloadTime); // check claim amount in edit claim and change coverage type
router.delete("/deleteClaimReporting/:reportingId", [verifyToken], claimExportController.deleteClaimReporting); // check claim amount in edit claim and change coverage type

module.exports = router;
