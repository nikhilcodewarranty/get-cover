const express = require("express");
const router = express.Router();
const customerController = require("../controller/customerController");
const swaggerUi = require('../swagger-ui-express');
const swaggerDocument = require('../swagger.json');

router.get("/api-v1/api-docs", swaggerDocument);
router.get("/customer/create-customer", customerController.createCustomer);

module.exports = router;