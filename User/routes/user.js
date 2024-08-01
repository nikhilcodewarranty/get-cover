const express = require("express");

const userController = require("../controller/usersController");// user controller
const dealerController = require("../../Dealer/controller/dealerController");// user controller
const servicerAdminController = require("../../Provider/controller/serviceAdminController");// user controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware');
const express = require("express");
const router = express.Router();

//-------------------- get api's endpoints--------------------------//

router.get("/users/:role", [verifyToken], userController.getAllUsers); // Get all users by role
router.get("/getUserById/:userId", [verifyToken], userController.getUserById); // Get user by ID
router.get("/getUserByToken", [verifyToken], userController.getUserByToken); // Get user by token
router.post("/checkEmailForSingle", [verifyToken], userController.checkEmailForSingle); // Check email for a single user
router.get("/roles", [verifyToken], userController.getAllRoles); // Get all roles
router.post("/approveDealers", [verifyToken], validator("filter_dealer"), dealerController.getAllDealers); // Get all dealers with filters
router.get("/approveServicer", [verifyToken], servicerAdminController.getAllServiceProviders); // Get all service providers
router.post("/pendingDealers", [verifyToken], validator("filter_dealer"), dealerController.getPendingDealers); // Get all pending dealers with filters
router.get("/servicer", [verifyToken], servicerAdminController.getAllServiceProviders); // Get all service providers
router.get("/getAllTerms", [verifyToken], userController.getAllTerms); // Get all terms
router.post("/getAllNotifications", [verifyToken], userController.getAllNotifications1); // Get all notifications
router.get("/readAllNotification", [verifyToken], userController.readAllNotification); // Read all notifications
router.get("/readNotification/:notificationId", [verifyToken], userController.readNotification); // Read a specific notification by ID
router.get("/getCountNotification", [verifyToken], userController.getCountNotification); // Get count of notifications
router.get("/getDashboardInfo", [verifyToken], userController.getDashboardInfo); // Get dashboard information
router.get("/getDashboardGraph", [verifyToken], userController.getDashboardGraph); // Get dashboard graph data
router.get("/getSkuData", [verifyToken], userController.getSkuData); // Get SKU data

//-------------------- post api's endpoints--------------------------//

router.post("/createSuperAdmin", userController.createSuperAdmin); // Create super admin credentials
router.post("/addMember", [verifyToken], userController.addMembers); // Add a member
router.post("/getMembers", [verifyToken], userController.getMembers); // Get members
router.post("/createTerms", userController.createTerms); // Create terms
router.post("/login", validator('login_validation'), userController.login); // Login for all users
router.post("/addRole", [verifyToken], validator("add_role_validation"), userController.addRole); // Add a role
router.post("/sendLinkToEmail", userController.sendLinkToEmail); // Send password reset link to email
router.post("/resetPassword/:userId/:code", userController.resetPassword); // Reset password
router.post("/dealerStatusUpdate", [verifyToken], dealerController.statusUpdate); // Update dealer status
router.post("/servicerStatusUpdate", [verifyToken], servicerAdminController.statusUpdate); // Update servicer status
router.post("/tryUpload", [verifyToken], uploadMiddleware.singleFileUpload, userController.tryUpload); // Try file upload
router.post("/updateProfile", [verifyToken], userController.updateProfile); // Update profile
router.put("/updatePassword", [verifyToken], userController.updatePassword); // Update password
router.put("/rejectDealer/:dealerId", [verifyToken], validator("approve_reject_dealer_validation"), dealerController.rejectDealer); // Reject a dealer by ID
router.put("/updateUserData/:userId", [verifyToken], userController.updateUserData); // Update user data by user ID
router.put("/updateUser/:userId", [verifyToken], userController.updateUser); // Update user by user ID
router.post("/approveDealer", [verifyToken], validator("create_dealer_validation"), userController.createDealer); // Approve a dealer
router.post("/checkEmail", [verifyToken], validator("email_validation"), userController.checkEmail); // Check email
router.post("/validateData", [verifyToken], userController.validateData); // Validate data

// Create dealer API from super admin
router.post("/createDealer", [verifyToken], userController.createDealer); // Create dealer

router.get("/checkToken", [verifyToken], userController.checkToken); // Check token
router.get("/getAccountInfo", [verifyToken], userController.getAccountInfo); // Get account information

// Create service provider API from super admin
router.post('/createServicer', [verifyToken], validator("create_service_provider_validation"), userController.createServiceProvider); // Create service provider
router.delete('/deleteUser/:userId', [verifyToken], userController.deleteUser); // Delete user by ID

router.post('/saleReporting', [verifyToken], userController.saleReporting); // Sale reporting
router.post('/saleReporting1', [verifyToken], userController.saleReporting1); // Sale reporting
router.post('/claimReporting', [verifyToken], userController.claimReporting); // Claim reporting

router.get('/checkIdAndToken/:userId/:code', userController.checkIdAndToken); // Check ID and token





module.exports = router;
