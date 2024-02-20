const express = require("express");
const router = express.Router();
const dealerUserController = require("../controller/dealerUserController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const validator = require('../config/validation');

router.post('/getDealerUsers',[verifyToken],dealerUserController.getDealerUsers)
router.post('/createOrder', [verifyToken], dealerUserController.createOrder)
router.post('/getPriceBooks',[verifyToken],dealerUserController.getPriceBooks)
router.post('/createDealerPriceBook',[verifyToken],dealerUserController.createDealerPriceBook)
router.post('/getAllPriceBooksByFilter',[verifyToken],dealerUserController.getAllPriceBooksByFilter)
router.post('/createCustomer',[verifyToken],dealerUserController.createCustomer)
router.post('/createDealerPriceBook',[verifyToken],dealerUserController.createDealerPriceBook)
router.post('/getDealerCustomers',[verifyToken],dealerUserController.getDealerCustomers)
router.put("/updateDealerPriceBook/:dealerPriceBookId", [verifyToken], dealerUserController.statusUpdate); 
router.post("/getResellerPriceBook/:resellerId", [verifyToken], dealerUserController.getResellerPriceBook); 
router.post('/getCustomerInOrder', [verifyToken], dealerUserController.getCustomerInOrder)
router.post('/getServicerInOrders', [verifyToken], dealerUserController.getServicerInOrders)

router.post('/getDealerResellers',[verifyToken],dealerUserController.getDealerResellers)
router.get('/getDealerPriceBookById/:dealerPriceBookId',[verifyToken],dealerUserController.getDealerPriceBookById)
router.post('/getCustomerOrders/:customerId',[verifyToken],dealerUserController.customerOrders)
router.post('/getResellerOrders/:resellerId',[verifyToken],dealerUserController.getResellerOrders)
router.post("/getResellerUsers/:resellerId", [verifyToken], dealerUserController.getResellerUsers);
router.post("/getResellerServicers/:resellerId", [verifyToken], dealerUserController.getResellerServicers)
router.post("/getResellerCustomers/:resellerId", [verifyToken], dealerUserController.getResellerCustomers);
router.post('/createReseller',[verifyToken],dealerUserController.createReseller)
router.post('/getCategoryAndPriceBooks', [verifyToken], dealerUserController.getCategoryAndPriceBooks)
router.post('/getDealerServicers',[verifyToken],dealerUserController.getDealerServicers)
router.post('/getDealerContracts',[verifyToken],dealerUserController.getAllContracts)

router.get('/getServicersList',[verifyToken],dealerUserController.getServicersList)
router.post('/createDeleteRelation',[verifyToken],dealerUserController.createDeleteRelation)

router.post('/getDealerOrders',[verifyToken],dealerUserController.getDealerOrders)




module.exports = router; 
