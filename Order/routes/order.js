const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post('/createOrder',[verifyToken],orderController.createOrder)
<<<<<<< HEAD
router.post('/checkFileValidation',[verifyToken],orderController.checkFileValidation)

=======
router.get('/getAllOrders',[verifyToken],orderController.getAllOrders)
>>>>>>> 3d864f3b1633281d25645fc757e6ccb184bce301


module.exports = router;
