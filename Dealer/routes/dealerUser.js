const express = require("express");
const router = express.Router();
const dealerUserController = require("../controller/dealerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/getDealerUsers',[verifyToken],dealerUserController.getDealerUsers)
router.post('/getPriceBooks',[verifyToken],dealerUserController.getPriceBooks)
router.post('/getAllPriceBooksByFilter',[verifyToken],dealerUserController.getAllPriceBooksByFilter)
router.post('/getDealerCustomers',[verifyToken],dealerUserController.getDealerCustomers)
router.post('/getDealerResellers',[verifyToken],dealerUserController.getDealerResellers)
router.post('/getDealerServicers',[verifyToken],dealerUserController.getDealerServicers)
router.get('/getServicersList',[verifyToken],dealerUserController.getServicersList)
router.post('/createDeleteRelation',[verifyToken],dealerUserController.createDeleteRelation)



module.exports = router; 
