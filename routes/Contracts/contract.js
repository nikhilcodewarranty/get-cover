
const express = require("express");// Import the express module
const router = express.Router();// Create a new router instance
const contractController = require("../../controllers/Contract/contracts");// Import the contract controller module
const { verifyToken } = require("../../middleware/auth");// Import the verifyToken middleware
const supportingFunction = require("../../config/supportingFunction");

router.post('/getContracts', [verifyToken], contractController.getContracts); // getContracts route
router.put('/editContract/:contractId', [verifyToken], contractController.editContract); // editContract route
router.get('/getContractById/:contractId', [verifyToken], supportingFunction.checkObjectId,contractController.getContractById); // getContractById route
router.get('/deleteOrdercontractbulk', [verifyToken], contractController.deleteOrdercontractbulk); // deleteOrdercontractbulk route
router.get('/cronJobEligible', contractController.cronJobEligible); // cronJobEligible route


module.exports = router;