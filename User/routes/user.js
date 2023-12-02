const express = require("express");
const router = express.Router();
const userController = require("../controller/usersController");
const {verifyToken} = require('../../middleware/auth')
const validator = require('../config/validation');
router.get("/users" ,[verifyToken],userController.getAllUsers);
router.get("/roles", [verifyToken],userController.getAllRoles);
router.get("/users",[verifyToken],userController.getAllUsers);
router.get("/roles",[verifyToken], userController.getAllRoles);


router.post("/createSuperAdmin", userController.createSuperAdmin);
router.post("/login",userController.login);
router.post("/addRole", userController.addRole);
router.post("/createDealer",[verifyToken], userController.createDealer);






module.exports = router;
