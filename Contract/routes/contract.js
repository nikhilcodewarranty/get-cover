const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");
const { verifyToken } = require("../../middleware/auth");

router.get("/getAllContracts",[verifyToken] ,contractController.getAllContracts);
router.post("/createContract",[verifyToken], contractController.createContract);

module.exports = router;
