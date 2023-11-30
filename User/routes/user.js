const express = require("express");
const router = express.Router();
const {getAllusers, createSuperAdmin, login} = require("../controller/usersController");

router.get("/users", getAllusers);
router.post("/createSuperAdmin", createSuperAdmin);
router.post("/login", login);
module.exports = router;
