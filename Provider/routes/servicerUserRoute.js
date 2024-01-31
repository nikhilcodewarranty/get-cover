const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const servicerController = require("../controller/servicerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware


router.get("/getServicerDetail",[verifyToken],servicerController.getServicerDetail)
router.post("/getServicerUsers",[verifyToken],servicerController.getServicerUsers)


module.exports = router;
