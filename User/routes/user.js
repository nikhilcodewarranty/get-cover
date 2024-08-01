const express = require("express");
const router = express.Router();
const userController = require("../controller/usersController"); // user controller
const dealerController = require("../../Dealer/controller/dealerController"); // dealer controller
const servicerAdminController = require("../../Provider/controller/serviceAdminController"); // servicer admin controller
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation'); // validation middleware
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware'); // upload middleware


router.get("/users/:role", [verifyToken], userController.getAllUsers); // get all users by role

router.get("/getUserById/:userId", [verifyToken], userController.getUserById); // get user by ID

router.get("/getUserByToken", [verifyToken], userController.getUserByToken); // get user by token

router.post("/checkEmailForSingle", [verifyToken], userController.checkEmailForSingle); // check email for single

router.get("/roles", [verifyToken], userController.getAllRoles); // get all roles

router.post("/approveDealers", [verifyToken], validator("filter_dealer"), dealerController.getAllDealers); // get all dealers

router.get("/approveServicer", [verifyToken], servicerAdminController.getAllServiceProviders); // get all service providers

router.post("/pendingDealers", [verifyToken], validator("filter_dealer"), dealerController.getPendingDealers); // get pending dealers

router.get("/servicer", [verifyToken], servicerAdminController.getAllServiceProviders); // get all service providers

router.get("/getAllTerms", [verifyToken], userController.getAllTerms); // get all terms

router.post("/getAllNotifications", [verifyToken], userController.getAllNotifications1); // get all notifications

router.get("/readAllNotification", [verifyToken], userController.readAllNotification); // read all notifications

router.get("/readNotification/:notificationId", [verifyToken], userController.readNotification); // read notification by ID

router.get("/getCountNotification", [verifyToken], userController.getCountNotification); // get notification count

router.get("/getDashboardInfo", [verifyToken], userController.getDashboardInfo); // get dashboard info

router.get("/getDashboardGraph", [verifyToken], userController.getDashboardGraph); // get dashboard graph

router.get("/getSkuData", [verifyToken], userController.getSkuData); // get SKU data

//-------------------- get api's endpoints--------------------------//

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

router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"), dealerController.rejectDealer); // reject dealer

router.put("/updateUserData/:userId", [verifyToken], userController.updateUserData); // update user data

router.put("/updateUser/:userId", [verifyToken], userController.updateUser); // update user

router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), userController.createDealer); // approve dealer

router.post("/checkEmail", [verifyToken], validator("email_validation"), userController.checkEmail); // check email

router.post("/validateData", [verifyToken], userController.validateData); // validate data

// create dealer API from super admin
router.post("/createDealer", [verifyToken], userController.createDealer); // create dealer

router.get("/checkToken", [verifyToken], userController.checkToken); // check token

router.get("/getAccountInfo", [verifyToken], userController.getAccountInfo); // get account info

// create service provider API from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), userController.createServiceProvider); // create service provider

router.delete('/deleteUser/:userId', [verifyToken], userController.deleteUser); // delete user

router.post('/saleReporting', [verifyToken], userController.saleReporting); // sale reporting

router.post('/saleReporting1', [verifyToken], userController.saleReporting1); // sale reporting 1

router.post('/claimReporting', [verifyToken], userController.claimReporting); // claim reporting

router.get('/checkIdAndToken/:userId/:code', userController.checkIdAndToken); // check ID and token

module.exports = router;
