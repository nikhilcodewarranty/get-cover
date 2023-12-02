const express = require("express");
const router = express.Router();
const priceController = require("../controller/priceController");
const {verifyToken} = require('../../middleware/auth')

// price book api's
router.post("/createPriceBook",[verifyToken],priceController.createPriceBook);
router.get("/priceBook",[verifyToken],priceController.getAllPriceBooks);
router.get("/priceBook/create-priceBook",[verifyToken], priceController.createPriceBook);


// price categories api's
router.post('/createPriceCat',[verifyToken],priceController.createPriceCat)
router.get('/getPriceCat',[verifyToken],priceController.getPriceCat)


module.exports = router;
