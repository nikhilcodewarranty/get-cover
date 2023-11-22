const express = require("express");
const router = express.Router();
const priceController = require("./controller");

router.get("/", priceController.getAllUsers);

module.exports = router;
