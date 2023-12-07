const { serviceProvider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
const providerService = require("../services/providerService");

exports.getAllServiceProviders = async (req, res, next) => {
  try {
    const serviceProviders = await providerService.getAllServiceProviders();
    if (!serviceProviders) {
      res.status(404).json("There are no service provider published yet!");
    }
    res.json(serviceProviders);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};


//-------------------------Created By Super Admin
exports.createServiceProvider = async (req, res, next) => {
  try {
    const createdServiceProvider = await providerService.createServiceProvider(
      req.body
    );
    if (!createdServiceProvider) {
      res.status(404).json("There are no service provider created yet!");
    }
    res.json(createdServiceProvider);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getServiceProviderById = async (req, res, next) => {
  try {
    const singleServiceProvider = await providerService.getServiceProviderById(
      serviceProviderId
    );
    if (!singleServiceProvider) {
      res.status(404).json("There are no service provider found yet!");
    }
    res.json(singleServiceProvider);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateServiceProvide = async (req, res, next) => {
  try {
    const updatedServiceProvide = await providerService.updateServiceProvide(
      req.body
    );
    if (!updatedServiceProvide) {
      res.status(404).json("There are no service provider updated yet!");
    }
    res.json(updatedServiceProvide);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteServiceProvide = async (req, res, next) => {
  try {
    const deletedServiceProvide = await providerService.deleteServiceProvide(
      req.body.id
    );
    if (!deletedServiceProvide) {
      res.status(404).json("There are no service provider deleted yet!");
    }
    res.json(deletedServiceProvide);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};


exports.registerServiceProvider = async (req, res, next) => {

  console.log(req.body)
  try {
    const createdServiceProvider = await providerService.registerServiceProvider(
      req.body
    );
    if (!createdServiceProvider) {
      res.status(404).json("There are no service provider created yet!");
    }
    res.json(createdServiceProvider);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

