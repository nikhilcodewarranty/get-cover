const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController"); // dealer controller 
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

//--------------- get api's endpoints ---------------------------//
router.get("/dealers", dealerController.getAllDealers); // get dealers list
router.get("/getDealerById", [verifyToken], dealerController.getDealerById); //get dealer detail with ID


module.exports = router;
