const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");
const { verifyToken } = require("../../middleware/auth");

router.post("/searchClaim", [verifyToken],claimController.searchClaim);

module.exports = router;
