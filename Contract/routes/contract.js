const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");
const { verifyToken } = require("../../middleware/auth");


router.post('/getAllContracts',[verifyToken],contractController.getAllContracts)


module.exports = router;
