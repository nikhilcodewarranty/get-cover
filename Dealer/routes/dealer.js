const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post("/register",dealerController.registerDealer)

//--------------- get api's endpoints ---------------------------//
router.get("/dealers",[verifyToken], dealerController.getAllDealers); // get dealers list
router.get("/getDealerById", [verifyToken], dealerController.getDealerById); //get dealer detail with ID
router.get("/dealerPriceBooks",[verifyToken],dealerController.getAllDealerPriceBooks);

router.put("/changedealerPriceBookStatus/:dealerPriceBook",[verifyToken],dealerController.statusUpdate); // update price book detail with ID




module.exports = router;
