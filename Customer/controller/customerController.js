const { Customer } = require("../model/customer");
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

exports.createCustomer = async (req, res, next) => {
  try {
    const createdCustomer = await customerService.createCustomer(req.body);
    if (!createdCustomer) {
      res.status(404).json("There are no customer created yet!");
    }
    res.json(createdCustomer);
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
    const updatedCustomer = await customerService.updateCustomer(req.body);
    if (!updatedCustomer) {
      res.status(404).json("There are no customer updated yet!");
    }
    res.json(updatedCustomer);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const deletedCustomer = await customerService.deleteCustomer(req.body.id);
    if (!deletedCustomer) {
      res.status(404).json("There are no customer deleted yet!");
    }
    res.json(deletedCustomer);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
