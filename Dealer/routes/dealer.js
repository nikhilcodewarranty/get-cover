const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController");

router.get("/dealer", dealerController.getAllDealers);
router.get("/dealer/create-dealer", dealerController.createDealer);

module.exports = router;
