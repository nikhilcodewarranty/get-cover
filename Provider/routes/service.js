const express = require("express");
const router = express.Router();
const serviceController = require("../controller/serviceController");

router.get("/serviceProvider/", serviceController.getAllServiceProviders);
router.get(
  "/serviceProvider/create-serviceProvider",
  serviceController.createServiceProvider
);

module.exports = router;
