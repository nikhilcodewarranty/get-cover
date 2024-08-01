
const express = require("express");// Import the express module
const router = express.Router();// Create a new router instance
const contractController = require("../controller/contracts");// Import the contract controller module
const { verifyToken } = require("../../middleware/auth");// Import the verifyToken middleware

router.post('/getAllContracts', [verifyToken], contractController.getAllContracts); // getAllContracts route

router.post('/getContracts', [verifyToken], contractController.getContracts); // getContracts route

router.put('/editContract/:contractId', [verifyToken], contractController.editContract); // editContract route

router.get('/getContractById/:contractId', [verifyToken], contractController.getContractById); // getContractById route

router.get('/deleteOrdercontractbulk', [verifyToken], contractController.deleteOrdercontractbulk); // deleteOrdercontractbulk route

router.get('/cronJobEligible', contractController.cronJobEligible); // cronJobEligible route

module.exports = router;
