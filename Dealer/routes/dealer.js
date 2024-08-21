const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../config/validation');
const supportingFunction = require('../../config/supportingFunction');
const dealerController = require("../controller/dealerController"); // dealer controller 
const dealerSupportingController = require("../controller/dealerSupporting"); // dealer get functions controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware 
const upload = multer({ dest: 'uploads/' });
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.post("/register", validator('register_dealer'), dealerController.registerDealer); // register dealer route
router.post("/addDealerUser", [verifyToken], dealerController.addDealerUser); // add dealer user route
router.post("/uploadTermAndCondition", [verifyToken], dealerController.uploadTermAndCondition); // upload terms and conditions
router.post("/createDealerPriceBook", [verifyToken], validator('create_dealer_price_book_validation'), dealerController.createDealerPriceBook); // create dealer price book
router.post("/checkDealerPriceBook", [verifyToken], dealerController.checkDealerPriceBook); // check dealer price book
router.post("/uploadDealerPriceBook", [verifyToken], dealerController.uploadDealerPriceBook); // upload dealer price book
router.post("/createRelationWithServicer/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerController.createDeleteRelation); // create relation with servicer
router.post("/unAssignServicer", [verifyToken], dealerController.unAssignServicer); // unassign servicer

router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], validator('update_dealer_price_validation'), supportingFunction.checkObjectId, dealerController.statusUpdate); // update price book detail with ID
router.put("/updateDealerMeta", [verifyToken], dealerController.updateDealerMeta); // update dealer meta
router.put("/changeDealerStatus/:dealerId", [verifyToken], validator('change_status_dealer'), supportingFunction.checkObjectId, dealerController.changeDealerStatus); // change dealer status


router.post("/dealers", [verifyToken], dealerSupportingController.getAllDealers); // get dealers list
router.post("/getUserByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getUserByDealerId); // get dealer detail with ID
router.post("/dealerOrders/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerOrders); // get dealer orders
router.post("/getDealerContract/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerContract); // get dealer contract
router.post("/getDealerClaims/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerClaims); // get dealer claims
router.post("/getAllPriceBooksByFilter", [verifyToken], validator('filter_price_book'), dealerSupportingController.getAllPriceBooksByFilter); // get all price books by filter
router.post("/getAllDealerPriceBooksByFilter", [verifyToken], validator('filter_dealer_price'), dealerSupportingController.getAllDealerPriceBooksByFilter); // get all dealer price books by filter
router.post("/getDealerResellers/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerResellers); // get dealer resellers
router.post("/getDealerServicers/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerServicers); // get dealer servicers

router.get("/getDealerById/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerById); // get dealer detail with ID
router.get("/dealerPriceBooks", [verifyToken], dealerSupportingController.getAllDealerPriceBooks); // get all dealer price books
router.get("/getDealerPriceBookById/:dealerPriceBookId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerPriceBookById); // get dealer price book by ID
router.get("/getDealerPriceBookByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerPriceBookByDealerId); // get dealer price book by dealer ID
router.get("/getServicersList/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getServicersList); // get servicers list
 

module.exports = router;
