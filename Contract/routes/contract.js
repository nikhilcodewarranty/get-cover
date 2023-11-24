const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");

router.get("/contract", contractController.getAllContracts);
router.get("/contract/create-contract", contractController.createContract);

module.exports = router;
