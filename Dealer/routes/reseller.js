const express = require("express");
const router = express.Router();
const resellerController = require("../controller/resellerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/createReseller', [verifyToken], validator('create_reseller'), resellerController.createReseller)
router.post('/getAllResellers', [verifyToken], resellerController.getAllResellers)





router.post("/getResellerServicers/:resellerId", [verifyToken], resellerController.getResellerServicers)
router.post("/getResellerByDealerId/:dealerId", [verifyToken], resellerController.getResellerByDealerId);
router.post("/addResellerUser", [verifyToken], resellerController.addResellerUser);
router.post("/getResselerByCustomer/:customerId", [verifyToken], resellerController.getResselerByCustomer);

router.get("/getResellerById/:resellerId", [verifyToken], resellerController.getResellerById);
router.get("/getDealerByReseller/:resellerId", [verifyToken], resellerController.getDealerByReseller);
router.post("/getResellerPriceBook/:resellerId", [verifyToken], resellerController.getResellerPriceBook);
router.post("/getResellerUsers/:resellerId", [verifyToken], resellerController.getResellerUsers);
router.post("/resellerOrders/:resellerId", [verifyToken], resellerController.getResellerOrders);

router.put("/editResellers/:resellerId", [verifyToken], resellerController.editResellers);
module.exports = router; 
