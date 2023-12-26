const express = require("express");
const router = express.Router();

const userController = require("../controller/usersController");// user controller
const dealerController = require("../../Dealer/controller/dealerController");// user controller
const serviceController = require("../../Provider/controller/serviceController");// user controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware');

//-------------------- get api's endpoints--------------------------//
router.get("/users/:role", [verifyToken], userController.getAllUsers); // get all users 
router.get("/getUserById/:userId", [verifyToken], userController.getUserById); // get all users 
router.get("/roles", [verifyToken], userController.getAllRoles); //get all roles
router.get("/approveDealers", [verifyToken], dealerController.getAllDealers); //get all dealers
router.get("/approveServicer", [verifyToken], serviceController.getAllServiceProviders); //get all dealers
router.get("/pendingDealers", [verifyToken], dealerController.getPendingDealers); //get all dealers
router.get("/pendingServicer", [verifyToken], serviceController.getPendingServicer); //get all dealers
router.get("/servicer", [verifyToken], serviceController.getAllServiceProviders); //get all dealers
router.get("/getAllTerms", [verifyToken], userController.getAllTerms); //get all dealers
router.get("/getAllNotifications", [verifyToken], userController.getAllNotifications); //get all dealers
router.get("/getCountNotification", [verifyToken], userController.getCountNotification); //get all dealers
router.get("/notificationStatusUpdate", [verifyToken], userController.notificationStatusUpdate); //get all dealers

//-------------------- get api's endpoints--------------------------//
router.post("/createSuperAdmin", userController.createSuperAdmin); //to create the super admin credentials
router.post("/createTerms", userController.createTerms); //to create the super admin credentials
router.post("/login", validator('login_validation'), userController.login); //login api for all users
router.post("/addRole", [verifyToken], validator("add_role_validation"), userController.addRole); //add role api
router.post("/sendLinkToEmail", userController.sendLinkToEmail); //send password link to email 
router.post("/resetPassword/:userId/:code", userController.resetPassword); //reset password 
router.post("/dealerStatusUpdate", [verifyToken], dealerController.statusUpdate); //Update Status
router.post("/servicerStatusUpdate", [verifyToken], serviceController.statusUpdate); //Update Status
router.post("/tryUpload", [verifyToken], uploadMiddleware.singleFileUpload,userController.tryUpload); //Update Status


router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"), dealerController.rejectDealer);
router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), userController.createDealer);
router.post("/checkEmail", [verifyToken],validator("email_validation"), userController.checkEmail);
router.post("/validateData", [verifyToken], userController.validateData);


//create dealer api from super admin
router.post("/createDealer",[verifyToken], userController.createDealer); 

//create service provider api from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), userController.createServiceProvider);




module.exports = router;
