const express = require("express");
const router = express.Router();
const resellerController = require("../controller/resellerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller)
router.post('/getAllResellers', [verifyToken], resellerController.getAllResellers)
router.post("/getResellerServicers", [verifyToken], resellerController.getResellerServicers)
router.post("/getResellerByDealerId/:dealerId", [verifyToken], resellerController.getResellerByDealerId);
router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser);
router.post("/getResselerByCustomer/:customerId", [verifyToken], resellerController.getResselerByCustomer);
router.post("/changeResellerStatus", [verifyToken], resellerController.changeResellerStatus);
router.post("/getResellerClaims", [verifyToken], resellerController.getResellerClaims);
router.post("/getResellerCustomers", [verifyToken], resellerController.getResellerCustomers);

router.get("/getResellerById", [verifyToken], resellerController.getResellerById);
router.get("/getDashboardData", [verifyToken], resellerController.getDashboardData);
router.get("/getDealerByReseller", [verifyToken], resellerController.getDealerByReseller);
router.post("/getResellerPriceBook", [verifyToken], resellerController.getResellerPriceBook);
router.post("/getResellerUsers", [verifyToken], resellerController.getResellerUsers);
router.post("/getResellerDetails", [verifyToken], resellerController.getResellerDetails);
router.post("/resellerOrders", [verifyToken], resellerController.getResellerOrders);
router.post("/getResellerContract", [verifyToken], resellerController.getResellerContract);

router.put("/editResellers", [verifyToken], resellerController.editResellers);
module.exports = router; 
