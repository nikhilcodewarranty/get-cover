const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");

router.get("/claim", claimController.getAllClaims);
router.post("/claim/create-claim", claimController.createClaim);

module.exports = router;
