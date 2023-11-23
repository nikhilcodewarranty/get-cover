const express = require("express");
const router = express.Router();
const priceController = require("../controller/priceController");

router.get("/priceBook", priceController.getAllPriceBooks);
router.get("/priceBook/create-priceBook", priceController.createPriceBook);

module.exports = router;
