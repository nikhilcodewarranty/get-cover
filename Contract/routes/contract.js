const express = require("express");
const router = express.Router();
const contractController = require("../controller/contracts");
const { verifyToken } = require("../../middleware/auth");


router.post('/getAllContracts',contractController.getAllContracts)
router.post('/getContracts',contractController.getContracts)
router.put('/editContract/:contractId',contractController.editContract)
router.get('/getContractById/:contractId',contractController.getContractById)
router.get('/deleteOrdercontractbulk',contractController.deleteOrdercontractbulk)
router.get('/cronJobEligible',contractController.cronJobEligible)

module.exports = router;
