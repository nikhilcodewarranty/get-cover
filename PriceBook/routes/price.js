const express = require("express");
const router = express.Router();
const priceController = require("../controller/priceController");

router.get("/", priceController.getAllPriceBook);

module.exports = router;
