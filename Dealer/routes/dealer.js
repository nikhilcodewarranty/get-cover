const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController");
const {verifyToken} = require('../../middleware/auth')

router.get("/dealers", dealerController.getAllDealers);
router.get("/getDealerById", [verifyToken],dealerController.getDealerById);

module.exports = router;
