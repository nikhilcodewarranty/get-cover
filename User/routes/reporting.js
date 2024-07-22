const express = require("express");
const router = express.Router();

const reportingController = require("../controller/reportingController");// reporting controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware


router.post('/getReportingDropdowns', [verifyToken], reportingController.getReportingDropdowns)
router.post('/claimReportinDropdown', [verifyToken], reportingController.claimReportinDropdown)


module.exports = router;
