const express = require("express");
const router = express.Router();
const {getAllusers} = require("../controller/usersController");

router.get("users/", getAllusers);
module.exports = router;
