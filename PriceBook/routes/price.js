const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const priceController = require("../controller/priceController"); // price controller 
const {verifyToken} = require('../../middleware/auth') // authentication with jwt as middleware

// price book api's
router.get("/priceBooks",[verifyToken],priceController.getAllPriceBooks); //get price books api
router.get("/getPriceBookById/:priceId",[verifyToken],priceController.getPriceBookById); //get price book detail with ID
router.post("/createPriceBook",[verifyToken],validator('create_price_validation'),priceController.createPriceBook); // create price book with defined price category ID
router.put("/updatePriceBook/:priceId",[verifyToken],validator('update_price_validation'),priceController.updatePriceBook); // update price book detail with ID


// price categories api's
router.post('/createPriceCat',[verifyToken],validator("create_price_cat_validation"),priceController.createPriceCat) // create price book category with uninque name
router.post('/searchPriceCategories',[verifyToken],validator("search_price_cat_validation"),priceController.searchPriceCategories) // search price book category with  name
router.put('/updatePriceCat/:catId',[verifyToken],validator("update_price_validation"),priceController.updatePriceCat) //update price book category with ID
router.get('/getPriceCat',[verifyToken],priceController.getPriceCat) // get price book category api
router.get('/getPriceCatById/:catId',[verifyToken],priceController.getPriceCatById) // get price book category detail with ID
router.put('/udpatePriceCat/:catId',[verifyToken],validator("create_price_cat_validation"),priceController.udpatePriceCat) //update price book category with ID
 

module.exports = router;
