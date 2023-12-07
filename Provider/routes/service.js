const express = require("express");
const router = express.Router();
const serviceController = require("../controller/serviceController");
router.post("/register",serviceController.registerServiceProvider)
router.get("/serviceProvider", serviceController.getAllServiceProviders);

router.get(
  "/serviceProvider/create-serviceProvider",
  serviceController.createServiceProvider
);

module.exports = router;
