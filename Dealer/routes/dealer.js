const express = require("express");
const router = express.Router();
const multer = require('multer');

const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const upload = multer({ dest: 'uploads/' });
router.post("/register",dealerController.registerDealer)
router.post("/uploadsDealerPriceBook",[verifyToken],upload.single('file'),dealerController.uploadPriceBook)

//--------------- get api's endpoints ---------------------------//
router.get("/dealers",[verifyToken], dealerController.getAllDealers); // get dealers list
router.get("/getDealerById", [verifyToken], dealerController.getDealerById); //get dealer detail with ID
router.get("/dealerPriceBooks",[verifyToken],dealerController.getAllDealerPriceBooks);

router.put("/updateDealerPriceBook/:dealerPriceBookId",[verifyToken],dealerController.statusUpdate); // update price book detail with ID




module.exports = router;
