const express = require("express");
const router = express.Router();
const userController = require("../controller/usersController");

router.get("/users", userController.getAllusers);
router.post("/createSuperAdmin", userController.createSuperAdmin);
router.post("/login", userController.login);
router.post("/createDealer", userController.createDealer);
module.exports = router;
