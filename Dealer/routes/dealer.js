const express = require("express");
const router = express.Router();
const multer = require('multer');
const validator = require('../config/validation');


const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const upload = multer({ dest: 'uploads/' });
router.post("/register",validator('register_dealer'),dealerController.registerDealer)
router.post("/uploadsDealerPriceBook",[verifyToken],upload.single('file'),dealerController.uploadPriceBook)

//--------------- get api's endpoints ---------------------------//
router.get("/dealers",[verifyToken], dealerController.getAllDealers); // get dealers list
router.get("/getDealerById", [verifyToken], dealerController.getDealerById); //get dealer detail with ID
router.get("/dealerPriceBooks",[verifyToken],dealerController.getAllDealerPriceBooks);

router.put("/updateDealerPriceBook/:dealerPriceBookId",[verifyToken],validator('update_dealer_price_validation'),dealerController.statusUpdate); // update price book detail with ID

router.post("/createDealerPriceBook",[verifyToken],validator('create_dealer_price_book_validation'),dealerController.createDealerPriceBook)


module.exports = router;
