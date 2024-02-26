const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");
const { verifyToken } = require("../../middleware/auth");

<<<<<<< HEAD
router.post("/searchClaim", [verifyToken],claimController.searchClaim);
router.post("/uploadReceipt", [verifyToken],claimController.uploadReceipt);
=======
router.get("/searchClaim",claimController.searchClaim);
>>>>>>> ad443cddd494e936f2bb41b7e4f1e6cbc45b2afb

module.exports = router;
