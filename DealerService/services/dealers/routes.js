const express = require("express");
const router = express.Router();
const dealerController = require("./controller");

router.get("/", dealerController.getAllUsers);
//router.post('/', dealerController.createUser);

module.exports = router;
