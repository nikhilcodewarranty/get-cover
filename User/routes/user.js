const express = require("express");
const router = express.Router();
const {getAllusers,createSuperAdmin} = require("../controller/usersController");

router.get("users/", getAllusers);
router.get("users/create-superAdmin/", createSuperAdmin);
module.exports = router;
