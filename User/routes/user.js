const express = require("express");
const router = express.Router();

const userController = require("../controller/usersController");// user controller
const dealerController = require("../../Dealer/controller/dealerController");// user controller
const serviceController = require("../../Provider/controller/serviceController");// user controller
const {verifyToken} = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');


//-------------------- get api's endpoints--------------------------//
router.get("/users" ,[verifyToken],userController.getAllUsers); // get all users 
router.get("/roles", [verifyToken],userController.getAllRoles); //get all roles
router.get("/dealers", [verifyToken],dealerController.getAllDealers); //get all dealers
router.get("/servicer", [verifyToken],serviceController.getAllServiceProviders); //get all dealers


//-------------------- get api's endpoints--------------------------//
router.post("/createSuperAdmin", userController.createSuperAdmin); //to create the super admin credentials
router.post("/login",validator('login_validation'),userController.login); //login api for all users
router.post("/addRole",[verifyToken],validator("add_role_validation") ,userController.addRole); //add role api
router.post("/dealerStatusUpdate",[verifyToken] ,dealerController.statusUpdate); //Update Status
router.post("/servicerStatusUpdate",[verifyToken] ,serviceController.statusUpdate); //Update Status

//create dealer api from super admin
router.post("/createDealer",[verifyToken],validator("create_dealer_validation"), userController.createDealer); 

//create service provider api from super admin
router.post('/createServiceProvider', [verifyToken],validator("create_service_provider_validation") ,userController.createServiceProvider );




module.exports = router;
