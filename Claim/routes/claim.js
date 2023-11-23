const express = require("express");
const router = express.Router();
const claimController = require("../controller/claim");

router.get("/claim", claimController.getAllClaims);

module.exports = router;
