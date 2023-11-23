const express = require("express");
const router = express.Router();
const contractController = require("../controller/contract");

router.get("/contract", contractController.getAllContracts);

module.exports = router;
