const express = require("express");
const router = express.Router();
const {getAllUsers, createSuperAdmin, login, addRole,getAllRoles} = require("../controller/usersController");

router.get("/users", getAllUsers);
router.get("/roles", getAllRoles);


router.post("/createSuperAdmin", createSuperAdmin);
router.post("/login", login);
router.post("/addRole", addRole);

module.exports = router;
