const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");
const { verifyToken } = require("../../middleware/auth");


router.post('/getAllContracts',[verifyToken],contractController.getAllContracts)
router.post('/editContract/:customerId',[verifyToken],contractController.editContract)
router.post('/getContractById/:customerId',[verifyToken],contractController.getContractById)


module.exports = router;
