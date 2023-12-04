const express = require("express");
const router = express.Router();
const dealerController = require("../controller/dealerController");
const {verifyToken} = require('../../middleware/auth')

router.get("/dealers", dealerController.getAllDealers);
router.post("/create-dealer", dealerController.createDealer);
// router.post("/statusUpdate", dealerController.statusUpdate);
router.get("/getDealerById", [verifyToken],dealerController.getDealerById);

module.exports = router;
