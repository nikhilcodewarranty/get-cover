const express = require("express");
const router = express.Router();
const priceController = require("../controller/priceController");
const {verifyToken} = require('../../middleware/auth')

// price book api's
router.post("/createPriceBook",[verifyToken],priceController.createPriceBook);
router.get("/priceBooks",[verifyToken],priceController.getAllPriceBooks);
router.get("/getPriceBookById/:priceId",[verifyToken],priceController.getPriceBookById);
router.put("/updatePriceBook/:priceId",[verifyToken],priceController.updatePriceBook);


// price categories api's
router.post('/createPriceCat',[verifyToken],priceController.createPriceCat)
router.get('/getPriceCat',[verifyToken],priceController.getPriceCat)
router.get('/getPriceCatById/:catId',[verifyToken],priceController.getPriceCatById)
router.put('/udpatePriceCat/:catId',[verifyToken],priceController.udpatePriceCat)


module.exports = router;
