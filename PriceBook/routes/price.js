const express = require("express");
const router = express.Router();
const validator = require('../config/validation')
const priceController = require("../controller/priceController");
const {verifyToken} = require('../../middleware/auth')

// price book api's
router.post("/createPriceBook",[verifyToken],priceController.createPriceBook);
router.get("/priceBooks",[verifyToken],priceController.getAllPriceBooks);
router.get("/getPriceBookById/:priceId",[verifyToken],priceController.getPriceBookById);
router.put("/updatePriceBook/:priceId",[verifyToken],priceController.updatePriceBook);


// price categories api's
router.post('/createPriceCat',[verifyToken],validator("create_price_cat_validation"),priceController.createPriceCat)
router.get('/getPriceCat',[verifyToken],priceController.getPriceCat)
router.get('/getPriceCatById/:catId',[verifyToken],priceController.getPriceCatById)
router.put('/udpatePriceCat/:catId',[verifyToken],validator("create_price_cat_validation"),priceController.udpatePriceCat)


module.exports = router;
