const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");
const { verifyToken } = require("../../middleware/auth");


router.post('/getAllContracts',[verifyToken],contractController.getAllContracts)
router.post('/getContracts',[verifyToken],contractController.getContracts)
router.put('/editContract/:contractId',[verifyToken],contractController.editContract)
router.get('/getContractById/:contractId',[verifyToken],contractController.getContractById)
router.get('/deleteOrdercontractbulk',[verifyToken],contractController.deleteOrdercontractbulk)
router.get('/cronJobEligible',contractController.cronJobEligible)

module.exports = router;
