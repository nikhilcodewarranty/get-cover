const express = require("express");
const router = express.Router();
const serviceController = require("../controller/serviceController");

router.get("/", serviceController.getAllServices);

module.exports = router;
