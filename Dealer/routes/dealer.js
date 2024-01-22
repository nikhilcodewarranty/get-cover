const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../config/validation');


const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const upload = multer({ dest: 'uploads/' });
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.post("/register",validator('register_dealer'),dealerController.registerDealer)
router.post("/addDealerUser",[verifyToken],dealerController.addDealerUser)
router.post("/uploadsDealerPriceBook",[verifyToken],uploadMiddleware.singleFileUpload,dealerController.uploadPriceBook)



//--------------- get api's endpoints ---------------------------//
router.post("/dealers",[verifyToken], dealerController.getAllDealers); // get dealers list
router.get("/getDealerById/:dealerId", [verifyToken], dealerController.getDealerById); //get dealer detail with ID
router.post("/getUserByDealerId/:dealerId", [verifyToken], dealerController.getUserByDealerId); //get dealer detail with ID
router.get("/getResellerByDealerId/:dealerId", [verifyToken], dealerController.getResellerByDealerId); //get dealer detail with ID
router.get("/dealerPriceBooks",[verifyToken],dealerController.getAllDealerPriceBooks);
router.put("/changeDealerStatus/:dealerId",[verifyToken],validator('change_status_dealer'),dealerController.changeDealerStatus);
router.get("/getDealerPriceBookById/:dealerPriceBookId",[verifyToken],dealerController.getDealerPriceBookById);
router.get("/getDealerPriceBookByDealerId/:dealerId",[verifyToken],dealerController.getDealerPriceBookByDealerId);
router.post("/getAllPriceBooksByFilter",[verifyToken],validator('filter_price_book'),dealerController.getAllPriceBooksByFilter);
router.post("/getAllDealerPriceBooksByFilter",[verifyToken],validator('filter_dealer_price'),dealerController.getAllDealerPriceBooksByFilter);

router.get("/getDealerRequest",[verifyToken],dealerController.getDealerRequest);

router.put("/updateDealerPriceBook/:dealerPriceBookId",[verifyToken],validator('update_dealer_price_validation'),dealerController.statusUpdate); // update price book detail with ID
router.put("/updateDealerMeta",[verifyToken],dealerController.updateDealerMeta); // update price book detail with ID
// update price book detail with ID

router.post("/createDealerPriceBook",[verifyToken],validator('create_dealer_price_book_validation'),dealerController.createDealerPriceBook)
router.post("/uploadDealerPriceBook",[verifyToken],dealerController.uploadDealerPriceBook)
router.post("/filterDealer",[verifyToken],dealerController.filterDealer)


router.post("/createRelationWithServicer/:dealerId",[verifyToken],dealerController.createDeleteRelation)
router.post("/getDealerServicers/:dealerId",[verifyToken],dealerController.getDealerServicers)
router.post("/unAssignServicer",[verifyToken],dealerController.unAssignServicer)
router.get("/getServicersList/:dealerId",[verifyToken],dealerController.getServicersList)

module.exports = router;
