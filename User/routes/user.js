const express = require("express");
const router = express.Router();

const userController = require("../controller/usersController");// user controller
const dealerController = require("../../Dealer/controller/dealerController");// user controller
const servicerAdminController = require("../../Provider/controller/serviceAdminController");// user controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware');

//-------------------- get api's endpoints--------------------------//
router.get("/users/:role", [verifyToken], userController.getAllUsers); // get all users 
router.get("/getUserById/:userId", [verifyToken], userController.getUserById); // get all users 
router.get("/getUserByToken", [verifyToken], userController.getUserByToken); // get all users 
router.post("/checkEmailForSingle", [verifyToken], userController.checkEmailForSingle); // get all users 
router.get("/roles", [verifyToken], userController.getAllRoles); //get all roles
router.post("/approveDealers", [verifyToken], validator("filter_dealer"), dealerController.getAllDealers); //get all dealers
router.get("/approveServicer", [verifyToken], servicerAdminController.getAllServiceProviders); //get all dealers
router.post("/pendingDealers", [verifyToken], validator("filter_dealer"), dealerController.getPendingDealers); //get all dealers
router.get("/servicer", [verifyToken], servicerAdminController.getAllServiceProviders); //get all dealers
router.get("/getAllTerms", [verifyToken], userController.getAllTerms); //get all dealers
router.post("/getAllNotifications", [verifyToken], userController.getAllNotifications1); //get all dealers
router.get("/readAllNotification", [verifyToken], userController.readAllNotification); //get all dealers
// router.get("/getAllNotifications1", [verifyToken], userController.getAllNotifications); //get all dealers
router.get("/readNotification/:notificationId", [verifyToken], userController.readNotification); //get
router.get("/getCountNotification", [verifyToken], userController.getCountNotification); //get all dealers
router.get("/notificationStatusUpdate/:flag", [verifyToken], userController.notificationStatusUpdate); //get all dealers
router.get("/getDashboardInfo", [verifyToken], userController.getDashboardInfo); //get dashboard info
router.get("/getDashboardGraph", [verifyToken], userController.getDashboardGraph); //get dashboard info
router.get("/getSkuData", [verifyToken], userController.getSkuData); //get dashboard info

//-------------------- get api's endpoints--------------------------//
router.post("/createSuperAdmin", userController.createSuperAdmin); //to create the super admin credentials

router.post("/addMember", [verifyToken], userController.addMembers); //to create the super admin credentials //notification
router.post("/getMembers", [verifyToken], userController.getMembers); //to create the super admin credentials
router.post("/createTerms", userController.createTerms); //to create the super admin credentials
router.post("/login", validator('login_validation'), userController.login); //login api for all users
router.post("/addRole", [verifyToken], validator("add_role_validation"), userController.addRole); //add role api
router.post("/sendLinkToEmail", userController.sendLinkToEmail); //send password link to email 
router.post("/resetPassword/:userId/:code", userController.resetPassword); //reset password 
router.post("/dealerStatusUpdate", [verifyToken], dealerController.statusUpdate); //Update Status
router.post("/servicerStatusUpdate", [verifyToken], servicerAdminController.statusUpdate); //Update Status
router.post("/tryUpload", [verifyToken], uploadMiddleware.singleFileUpload, userController.tryUpload); //Update Status
router.post("/updateProfile", [verifyToken], userController.updateProfile); //Update Profile
router.put("/updatePassword", [verifyToken], userController.updatePassword); //Update Password



router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"), dealerController.rejectDealer);
router.put("/updateUserData/:userId", [verifyToken], userController.updateUserData);
router.put("/updateUser/:userId", [verifyToken], userController.updateUser);
router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), userController.createDealer);
router.post("/checkEmail", [verifyToken], validator("email_validation"), userController.checkEmail);
router.post("/validateData", [verifyToken], userController.validateData);

 
//create dealer api from super admin
router.post("/createDealer", [verifyToken], userController.createDealer);
router.get("/checkToken", [verifyToken], userController.checkToken);
router.get("/getAccountInfo", [verifyToken], userController.getAccountInfo);
//create service provider api from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), userController.createServiceProvider);
router.delete('/deleteUser/:userId', [verifyToken], userController.deleteUser);



router.post('/saleReporting',[verifyToken], userController.saleReporting);
router.post('/saleReporting1',[verifyToken], userController.saleReporting1);
router.post('/claimReporting',[verifyToken], userController.claimReporting);





module.exports = router;
