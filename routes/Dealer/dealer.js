const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../../middleware/validator');
const dealerController = require("../../controllers/Dealer/dealerController"); // dealer controller 
const eligibiltyContoller = require("../../controllers/Dealer/eligibiltyContoller"); // dealer controller 
const dealerSupportingController = require("../../controllers/Dealer/dealerSupporting"); // dealer get functions controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware 
const supportingFunction = require('../../config/supportingFunction');

router.post("/register", validator('register_dealer'), dealerController.registerDealer); // register dealer route
router.post("/addDealerUser", [verifyToken], dealerController.addDealerUser); // add dealer user route
router.post("/uploadTermAndCondition", [verifyToken], dealerController.uploadTermAndCondition); // upload terms and conditions
router.post("/createDealerPriceBook", [verifyToken], dealerController.createDealerPriceBook); // create dealer price book
router.post("/checkDealerPriceBook", [verifyToken], dealerController.checkDealerPriceBook); // check dealer price book
router.post("/uploadDealerPriceBook1", [verifyToken], dealerController.uploadDealerPriceBook); // upload dealer price book
router.post("/uploadDealerPriceBook", [verifyToken], dealerController.uploadDealerPriceBookNew); // upload dealer price book
router.post("/createRelationWithServicer/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerController.createDeleteRelation); // create relation with servicer
router.post("/unAssignServicer", [verifyToken], dealerController.unAssignServicer); // unassign servicer

// router.post('/saveDealerSetting', [verifyToken], dealerController.saveDealerSetting);

// router.post('/resetDealerSetting', [verifyToken], dealerController.resetDealerSetting)

// router.get('/getDealerColorSetting/:dealerId',[verifyToken], dealerController.getDealerSetting);

// router.get('/defaultSettingDealer', [verifyToken], dealerController.defaultSettingDealer);


router.get("/saveOldDealerSku", dealerController.saveOldDealerSku); // unassign servicer
router.get("/saveOldDealers", dealerController.oldDealers); // unassign servicer


router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], supportingFunction.checkObjectId, dealerController.statusUpdate); // update price book detail with ID
router.put("/updateDealerMeta", [verifyToken], dealerController.updateDealerMeta); // update dealer meta
router.put("/updateDealerSetting/:dealerId", [verifyToken], dealerController.updateDealerSetting); // update dealer setting
router.put("/changeDealerStatus/:dealerId", [verifyToken], validator('change_status_dealer'), supportingFunction.checkObjectId, dealerController.changeDealerStatus); // change dealer status

router.post('/saveDealerSetting', [verifyToken], dealerController.saveDealerSetting);

router.post('/resetDealerSetting', [verifyToken], dealerController.resetDealerSetting)

router.get('/getDealerColorSetting/:dealerId', [verifyToken], dealerController.getDealerColorSetting);

router.post('/uploadBannerImage',  dealerController.uploadBannerImage);


router.get('/defaultSettingDealer/:dealerId', [verifyToken], dealerController.defaultSettingDealer);

router.post("/dealers", [verifyToken], dealerSupportingController.getAllDealers); // get dealers list
router.post("/getUserByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getUserByDealerId); // get dealer detail with ID
router.post("/dealerOrders/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerOrders); // get dealer orders
router.post("/getDealerContract/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerContract); // get dealer contract
router.post("/getDealerClaims/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerClaims); // get dealer claims
router.post("/getDealerAsServicerClaims/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerAsServicerClaims); // get dealer claims
router.post("/getAllPriceBooksByFilter", [verifyToken], validator('filter_price_book'), dealerSupportingController.getAllPriceBooksByFilter); // get all price books by filter
router.post("/getAllDealerPriceBooksByFilter", [verifyToken], validator('filter_dealer_price'), dealerSupportingController.getAllDealerPriceBooksByFilter); // get all dealer price books by filter
router.post("/getDealerResellers/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerResellers); // get dealer resellers
router.post("/getDealerServicers/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerServicers); // get dealer servicers

router.get("/getDealerById/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerById); // get dealer detail with ID
router.get("/dealerPriceBooks", [verifyToken], dealerSupportingController.getAllDealerPriceBooks); // get all dealer price books
router.get("/getDealerPriceBookById/:dealerPriceBookId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerPriceBookById); // get dealer price book by ID
router.get("/getDealerPriceBookByDealerId/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getDealerPriceBookByDealerId); // get dealer price book by dealer ID
router.get("/getServicersList/:dealerId", [verifyToken], supportingFunction.checkObjectId, dealerSupportingController.getServicersList); // get servicers list

router.post("/createEligibility", [verifyToken], eligibiltyContoller.createEligibility); // get servicers list

router.get("/getDealerSettings/:dealerId", [verifyToken], dealerSupportingController.getDealerSettings); // get servicers list

router.post("/checkEligibiltyForContracts", dealerController.checkEligibiltyForContracts); // get servicers list


module.exports = router;
