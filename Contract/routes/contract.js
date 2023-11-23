const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");

router.get("/contracts", contractController.getAllContracts);

module.exports = router;
