const express = require("express");
const router = express.Router();
const userController = require("../../controllers/User/usersController"); // user controller
const maillogController = require("../../controllers/User/maillogController"); // mail log controller
const supportingApiAdmin = require("../../controllers/User/supportingApiAdmin"); // admin supporting function for creation role controller
const graphdataController = require("../../controllers/User/graphdataController"); // admin graph data  controller
const dealerController = require("../../controllers/Dealer/dealerController"); // dealer controller
const dealerSupportingController = require("../../controllers/Dealer/dealerSupporting"); // dealer controller
const servicerAdminController = require("../../controllers/Provider/serviceAdminController"); // servicer admin controller
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../../middleware/validator'); // validation middleware
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
router.get("/readNotification/:notificationId", [verifyToken], supportingFunction.checkObjectId, userController.readNotification); // read notification by ID
router.get("/getCountNotification", [verifyToken], userController.getCountNotification); // get notification count

// Setting Routes

router.post('/setting', [verifyToken], userController.accountSetting);
router.get('/updateDataBase', userController.updateDataBase);
router.post('/resetSetting', [verifyToken], userController.resetSetting)
router.post('/setting/uploadLogo', [verifyToken], userController.uploadLogo);
router.get('/setting/getSetting', [verifyToken], userController.getSetting);
router.get('/setting/preLoginData', userController.preLoginData);
router.get('/setting/setDefault', [verifyToken], userController.setDefault);

//Save Contact form 
router.post('/contact-us', userController.contactUs);
//Option Dropdown 
router.post('/saveOptions', [verifyToken], userController.saveOptions);
//edit Dropdown
router.put('/editOption', [verifyToken], userController.editOption);
router.get('/getOption/:name', [verifyToken], userController.getOptions)
router.get('/getOptions/:filter', [verifyToken], userController.getOptions1)
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
router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"), supportingFunction.checkObjectId, dealerController.rejectDealer); // reject dealer
router.put("/updateThreshHoldLimit", [verifyToken], userController.updateThreshHoldLimit); // reject dealer
router.put("/updateUserData/:userId", [verifyToken], userController.updateUserData); // update user data
router.put("/updateUser/:userId", [verifyToken], userController.updateUser); // update user
router.post("/checkEmail", [verifyToken], validator("email_validation"), userController.checkEmail); // check email
router.post("/updateData", supportingApiAdmin.updateData); // for backend use only
router.get("/getUserNotificationData/:userId/:flag", [verifyToken], supportingApiAdmin.getUserNotificationData); // get notification data for sinlge user
router.put("/updateNotificationData/:userId", [verifyToken], supportingApiAdmin.updateNotificationData); // update notification data for sinlge user
router.get("/downloadFile", userController.downloadFile); // check email
router.post("/validateData", [verifyToken], userController.validateData); // validate data
router.get("/checkToken", [verifyToken], userController.checkToken); // check token
router.get("/getAccountInfo", [verifyToken], userController.getAccountInfo); // get account info
router.delete('/deleteUser/:userId', [verifyToken], userController.deleteUser); // delete user
router.get('/checkIdAndToken/:userId/:code', userController.checkIdAndToken); // check ID and token
router.get("/getDashboardInfo", [verifyToken], graphdataController.getDashboardInfo); // get dashboard info
router.get("/getDashboardGraph", [verifyToken], graphdataController.getDashboardGraph); // get dashboard graph
router.get("/getSkuData", [verifyToken], graphdataController.getSkuData); // get SKU data
router.post('/saleReporting', [verifyToken], graphdataController.saleReporting); // sale reporting
router.post('/claimReporting', [verifyToken], graphdataController.claimReporting); // claim reporting
router.get("/downloadFile1/:token/:folder/:key", [verifyToken], userController.downloadFile1); // check email
router.post("/downloadFile", userController.downloadFile); // check email
router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), supportingApiAdmin.createDealer); // approve dealer
router.post("/createDealer", [verifyToken], supportingApiAdmin.createDealer); // create dealer API from super admin
router.post("/convertToBase64", supportingApiAdmin.convertToBase64); // create dealer API from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), supportingApiAdmin.createServiceProvider);// create service provider API from super admin

//reporting keys functions
router.post("/createReportingKeys",[verifyToken], supportingApiAdmin.createReportingKeys); // 
router.get("/getReportingKeys", [verifyToken], supportingApiAdmin.getReportingKeys); // 


router.get('/updateContracts', [verifyToken], userController.updateContracts);
router.get('/webhookData', [verifyToken], maillogController.webhookData);

console.log("under webhook data +++++++++++")
router.post('/webhookData', maillogController.webhookData)
router.post('/getMaillogData', [verifyToken], maillogController.getMaillogData)
// router.post('/webhookData', maillogController.webhookData)
module.exports = router;