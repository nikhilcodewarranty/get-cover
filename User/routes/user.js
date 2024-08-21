const express = require("express");
const router = express.Router();
const userController = require("../controller/usersController"); // user controller
const supportingApiAdmin = require("../controller/supportingApiAdmin"); // admin supporting function for creation role controller
const graphdataController = require("../controller/graphdataController"); // admin graph data  controller
const dealerController = require("../../Dealer/controller/dealerController"); // dealer controller
const dealerSupportingController = require("../../Dealer/controller/dealerSupporting"); // dealer controller
const servicerAdminController = require("../../Provider/controller/serviceAdminController"); // servicer admin controller
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation'); // validation middleware
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware'); // upload middleware
const supportingFunction = require("../../config/supportingFunction");

router.get("/users/:role", [verifyToken], userController.getAllUsers); // get all users by role
router.get("/getUserById/:userId", [verifyToken], supportingFunction.checkObjectId, userController.getUserById); // get user by ID
router.get("/getUserByToken", [verifyToken], userController.getUserByToken); // get user by token
router.post("/checkEmailForSingle", [verifyToken], userController.checkEmailForSingle); // check email for single
router.get("/roles", [verifyToken], userController.getAllRoles); // get all roles
router.post("/approveDealers", [verifyToken], validator("filter_dealer"), dealerSupportingController.getAllDealers); // get all dealers
router.get("/approveServicer", [verifyToken], servicerAdminController.getAllServiceProviders); // get all service providers
router.post("/pendingDealers", [verifyToken], validator("filter_dealer"), dealerSupportingController.getPendingDealers); // get pending dealers
router.get("/servicer", [verifyToken], servicerAdminController.getAllServiceProviders); // get all service providers
router.get("/getAllTerms", [verifyToken], userController.getAllTerms); // get all terms
router.post("/getAllNotifications", [verifyToken], userController.getAllNotifications1); // get all notifications
router.get("/readAllNotification", [verifyToken], userController.readAllNotification); // read all notifications
router.get("/readNotification/:notificationId", [verifyToken], supportingFunction.checkObjectId,userController.readNotification); // read notification by ID
router.get("/getCountNotification", [verifyToken], userController.getCountNotification); // get notification count

router.post("/createSuperAdmin", userController.createSuperAdmin); // create super admin credentials
router.post("/addMember", [verifyToken], userController.addMembers); // add member
router.post("/getMembers", [verifyToken], userController.getMembers); // get members
router.post("/createTerms", userController.createTerms); // create terms
router.post("/login", validator('login_validation'), userController.login); // login for all users
router.post("/addRole", [verifyToken], validator("add_role_validation"), userController.addRole); // add role
router.post("/sendLinkToEmail", userController.sendLinkToEmail); // send password link to email
router.post("/resetPassword/:userId/:code", userController.resetPassword); // reset password
router.post("/dealerStatusUpdate", [verifyToken], dealerController.statusUpdate); // update dealer status
router.post("/servicerStatusUpdate", [verifyToken], servicerAdminController.statusUpdate); // update servicer status
router.post("/updateProfile", [verifyToken], userController.updateProfile); // update profile
router.put("/updatePassword", [verifyToken], userController.updatePassword); // update password
router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"),supportingFunction.checkObjectId, dealerController.rejectDealer); // reject dealer
router.put("/updateUserData/:userId", [verifyToken], userController.updateUserData); // update user data
router.put("/updateUser/:userId", [verifyToken], userController.updateUser); // update user
router.post("/checkEmail", [verifyToken], validator("email_validation"), userController.checkEmail); // check email
router.post("/downloadFile", [verifyToken], userController.downloadFile); // check email
router.post("/validateData", [verifyToken], userController.validateData); // validate data
router.get("/checkToken", [verifyToken], userController.checkToken); // check token
router.get("/getAccountInfo", [verifyToken], userController.getAccountInfo); // get account info
router.delete('/deleteUser/:userId', [verifyToken], userController.deleteUser); // delete user
router.get('/checkIdAndToken/:userId/:code',supportingFunction.checkObjectId, userController.checkIdAndToken); // check ID and token
router.get("/getDashboardInfo", [verifyToken], graphdataController.getDashboardInfo); // get dashboard info
router.get("/getDashboardGraph", [verifyToken], graphdataController.getDashboardGraph); // get dashboard graph
router.get("/getSkuData", [verifyToken], graphdataController.getSkuData); // get SKU data
router.post('/saleReporting', [verifyToken], graphdataController.saleReporting); // sale reporting
router.post('/claimReporting', [verifyToken], graphdataController.claimReporting); // claim reporting
router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), supportingApiAdmin.createDealer); // approve dealer
router.post("/createDealer", [verifyToken], supportingApiAdmin.createDealer); // create dealer API from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), supportingApiAdmin.createServiceProvider);// create service provider API from super admin

module.exports = router;
