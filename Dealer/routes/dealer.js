const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../config/validation');
const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware 
const upload = multer({ dest: 'uploads/' });
const uploadMiddleware = require('../middleware/uploadMiddleware'); 


router.post("/register", validator('register_dealer'), dealerController.registerDealer); // register dealer route

router.post("/addDealerUser", [verifyToken], dealerController.addDealerUser); // add dealer user route

router.post("/uploadsDealerPriceBook", [verifyToken], uploadMiddleware.singleFileUpload, dealerController.uploadPriceBook); // upload dealer price book route

router.post("/dealers", [verifyToken], dealerController.getAllDealers); // get dealers list

router.post("/getUserByDealerId/:dealerId", [verifyToken], dealerController.getUserByDealerId); // get dealer detail with ID

router.post("/dealerOrders/:dealerId", [verifyToken], dealerController.getDealerOrders); // get dealer orders

router.post("/getDealerContract/:dealerId", [verifyToken], dealerController.getDealerContract); // get dealer contract

router.post("/getDealerClaims/:dealerId", [verifyToken], dealerController.getDealerClaims); // get dealer claims

router.post("/uploadTermAndCondition", [verifyToken], dealerController.uploadTermAndCondition); // upload terms and conditions

router.post("/getAllPriceBooksByFilter", [verifyToken], validator('filter_price_book'), dealerController.getAllPriceBooksByFilter); // get all price books by filter

router.post("/getAllDealerPriceBooksByFilter", [verifyToken], validator('filter_dealer_price'), dealerController.getAllDealerPriceBooksByFilter); // get all dealer price books by filter

router.post("/getDealerResellers/:dealerId", [verifyToken], dealerController.getDealerResellers); // get dealer resellers

router.post("/createDealerPriceBook", [verifyToken], validator('create_dealer_price_book_validation'), dealerController.createDealerPriceBook); // create dealer price book

router.post("/checkDealerPriceBook", [verifyToken], dealerController.checkDealerPriceBook); // check dealer price book

router.post("/uploadDealerPriceBook", [verifyToken], dealerController.uploadDealerPriceBook); // upload dealer price book

router.post("/filterDealer", [verifyToken], dealerController.filterDealer); // filter dealer

router.post("/createRelationWithServicer/:dealerId", [verifyToken], dealerController.createDeleteRelation); // create relation with servicer

router.post("/getDealerServicers/:dealerId", [verifyToken], dealerController.getDealerServicers); // get dealer servicers

router.post("/unAssignServicer", [verifyToken], dealerController.unAssignServicer); // unassign servicer

//--------------------------------------------------- get api's endpoints ---------------------------//


router.get("/getDealerById/:dealerId", [verifyToken], dealerController.getDealerById); // get dealer detail with ID

router.get("/dealerPriceBooks", [verifyToken], dealerController.getAllDealerPriceBooks); // get all dealer price books

router.get("/getDealerPriceBookById/:dealerPriceBookId", [verifyToken], dealerController.getDealerPriceBookById); // get dealer price book by ID

router.get("/getDealerPriceBookByDealerId/:dealerId", [verifyToken], dealerController.getDealerPriceBookByDealerId); // get dealer price book by dealer ID

router.get("/getDealerRequest", [verifyToken], dealerController.getDealerRequest); // get dealer request

router.get("/getServicersList/:dealerId", [verifyToken], dealerController.getServicersList); // get servicers list

//--------------------------------------------------- Put api's endpoints ---------------------------//

router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], validator('update_dealer_price_validation'), dealerController.statusUpdate); // update price book detail with ID

router.put("/updateDealerMeta", [verifyToken], dealerController.updateDealerMeta); // update dealer meta

router.put("/changeDealerStatus/:dealerId", [verifyToken], validator('change_status_dealer'), dealerController.changeDealerStatus); // change dealer status


module.exports = router;
