const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController");

router.get("/", dealerController.getAllDealer);

module.exports = router;
