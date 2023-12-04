const express = require("express");
const router = express.Router();

const userController = require("../controller/usersController");// user controller
const {verifyToken} = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');


//-------------------- get api's endpoints--------------------------//
router.get("/users" ,[verifyToken],userController.getAllUsers); // get all users 
router.get("/roles", [verifyToken],userController.getAllRoles); //get all roles


//-------------------- get api's endpoints--------------------------//
router.post("/createSuperAdmin", userController.createSuperAdmin); //to create the super admin credentials
router.post("/login",validator('login_validation'),userController.login); //login api for all users
router.post("/addRole",[verifyToken],validator("add_role_validation") ,userController.addRole); //add role api
router.post("/createDealer",[verifyToken],validator("create_dealer_validation"), userController.createDealer); //create dealer api from super admin






module.exports = router;
