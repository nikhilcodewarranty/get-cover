const express = require("express");
const router = express.Router();
const customerController = require("./controller");

router.get("/", customerController.getAllUsers);

module.exports = router;
