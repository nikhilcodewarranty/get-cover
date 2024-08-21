const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../config/validation');
const dealerController = require("../../controllers/Dealer/dealerController"); // dealer controller 
const dealerSupportingController = require("../../controllers/Dealer/dealerSupporting"); // dealer get functions controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware 


router.post("/register", validator('register_dealer'), dealerController.registerDealer); // register dealer route
router.post("/addDealerUser", [verifyToken], dealerController.addDealerUser); // add dealer user route
router.post("/uploadTermAndCondition", [verifyToken], dealerController.uploadTermAndCondition); // upload terms and conditions
router.post("/createDealerPriceBook", [verifyToken], validator('create_dealer_price_book_validation'), dealerController.createDealerPriceBook); // create dealer price book
router.post("/checkDealerPriceBook", [verifyToken], dealerController.checkDealerPriceBook); // check dealer price book
router.post("/uploadDealerPriceBook", [verifyToken], dealerController.uploadDealerPriceBook); // upload dealer price book
router.post("/createRelationWithServicer/:dealerId", [verifyToken], dealerController.createDeleteRelation); // create relation with servicer
router.post("/unAssignServicer", [verifyToken], dealerController.unAssignServicer); // unassign servicer

router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], validator('update_dealer_price_validation'), dealerController.statusUpdate); // update price book detail with ID
router.put("/updateDealerMeta", [verifyToken], dealerController.updateDealerMeta); // update dealer meta
router.put("/changeDealerStatus/:dealerId", [verifyToken], validator('change_status_dealer'), dealerController.changeDealerStatus); // change dealer status


router.post("/dealers", [verifyToken], dealerSupportingController.getAllDealers); // get dealers list
router.post("/getUserByDealerId/:dealerId", [verifyToken], dealerSupportingController.getUserByDealerId); // get dealer detail with ID
router.post("/dealerOrders/:dealerId", [verifyToken], dealerSupportingController.getDealerOrders); // get dealer orders
router.post("/getDealerContract/:dealerId", [verifyToken], dealerSupportingController.getDealerContract); // get dealer contract
router.post("/getDealerClaims/:dealerId", [verifyToken], dealerSupportingController.getDealerClaims); // get dealer claims
router.post("/getAllPriceBooksByFilter", [verifyToken], validator('filter_price_book'), dealerSupportingController.getAllPriceBooksByFilter); // get all price books by filter
router.post("/getAllDealerPriceBooksByFilter", [verifyToken], validator('filter_dealer_price'), dealerSupportingController.getAllDealerPriceBooksByFilter); // get all dealer price books by filter
router.post("/getDealerResellers/:dealerId", [verifyToken], dealerSupportingController.getDealerResellers); // get dealer resellers
router.post("/getDealerServicers/:dealerId", [verifyToken], dealerSupportingController.getDealerServicers); // get dealer servicers

router.get("/getDealerById/:dealerId", [verifyToken], dealerSupportingController.getDealerById); // get dealer detail with ID
router.get("/dealerPriceBooks", [verifyToken], dealerSupportingController.getAllDealerPriceBooks); // get all dealer price books
router.get("/getDealerPriceBookById/:dealerPriceBookId", [verifyToken], dealerSupportingController.getDealerPriceBookById); // get dealer price book by ID
router.get("/getDealerPriceBookByDealerId/:dealerId", [verifyToken], dealerSupportingController.getDealerPriceBookByDealerId); // get dealer price book by dealer ID
router.get("/getServicersList/:dealerId", [verifyToken], dealerSupportingController.getServicersList); // get servicers list


module.exports = router;
