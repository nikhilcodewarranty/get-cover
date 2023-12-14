const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const priceController = require("../controller/priceController"); // price controller 
const {verifyToken} = require('../../middleware/auth') // authentication with jwt as middleware

// price book api's
router.post("/createPriceBook",[verifyToken],validator('create_price_validation'),priceController.createPriceBook); // create price book with defined price category ID
router.get("/getPriceBookById/:priceBookId",[verifyToken],priceController.getPriceBookById); //get price book detail with ID
router.post("/priceBooks",[verifyToken],priceController.getAllPriceBooks); //get price books api
router.get("/getAllActivePriceBook",[verifyToken],priceController.getAllActivePriceBook); //get price books api
router.post("/searchPriceBook",[verifyToken],validator('search_price_book_validation'),priceController.searchPriceBook); // search price book with defined price category ID
//router.put("/updatePriceBook/:priceId",[verifyToken],validator('update_price_validation'),priceController.updatePriceBook); // update price book detail with ID
router.put("/updatePriceBook/:priceBookId",[verifyToken],validator('update_price_validation'),priceController.updatePriceBookById); // update price book detail with ID
router.get("/getPriceBookByCategory/:categoryName",[verifyToken],priceController.getPriceBookByCategory); // update price book detail with ID


// price categories api's
router.post('/createPriceBookCategory',[verifyToken],validator("create_price_cat_validation"),priceController.createPriceBookCat) // create price book category with uninque name
router.post('/searchPriceBookCategories',[verifyToken],validator("search_price_cat_validation"),priceController.searchPriceBookCategories) // search price book category with  name
router.put('/updatePriceBookCategory/:catId',[verifyToken],validator("update_price_cat_validation"),priceController.updatePriceBookCat) //update price book category with ID
//router.put('/updateCategory/:catId',[verifyToken],validator("update_price_cat_validation"),priceController.updatePriceBookCat) //update price book category with ID
router.post('/getPriceBookCategories',[verifyToken],priceController.getPriceBookCat) // get price book category api
router.get('/getActivePriceBookCategories',[verifyToken],priceController.getActivePriceBookCategories) // get price book category api
router.get('/getPriceBookCategoryById/:name',[verifyToken],priceController.getPriceBookCatById) // get price book by category
router.get('/getCategoryByPriceBook/:name',[verifyToken],priceController.getCategoryByPriceBook) // get price book category by price book

// Dealer Price Book api's



module.exports = router;
