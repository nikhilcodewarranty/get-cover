const { Customers } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");

exports.getAllCustomers = async (req, res, next) => {
  try {
    const customers = await customerService.getAllCustomers();
    if (!customers) {
      res.status(404).json("There are no customer published yet!");
    }
    res.json(customers);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createCustomers = async (req, res, next) => {
  try {
    const createdCustomers = await customerService.createCustomers(req.body);
    if (!createdCustomers) {
      res.status(404).json("There are no customer created yet!");
    }
    res.json(createdCustomers);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const singleCustomer = await customerService.getCustomerById(customerId);
    if (!singleCustomer) {
      res.status(404).json("There are no customer found yet!");
    }
    res.json(singleCustomer);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const updateCustomer = await customerService.updateCustomer(req.body);
    if (!updateCustomer) {
      res.status(404).json("There are no customer updated yet!");
    }
    res.json(updateCustomer);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const deleteCustomer = await customerService.deleteCustomer(req.body.id);
    if (!deleteCustomer) {
      res.status(404).json("There are no customer deleted yet!");
    }
    res.json(deleteCustomer);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
