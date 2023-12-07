const { serviceProvider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
const providerService = require("../services/providerService");
const role = require("../../User/model/role");
const userService = require("../../User/services/userService");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
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


/**---------------------------------------------Register Service Provider---------------------------------------- */
exports.registerServiceProvider = async (req, res) => {
  try {
    const data = req.body;

    console.log('Service Provder---------------------',data);
    
    // Extracting necessary data for dealer creation
    const providerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
    };

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: data.role });
    console.log('Roles--------------------------',checkRole)
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: 'Invalid role',
      });
    }

    // Register the dealer
    const createMetaData = await providerService.registerServiceProvider(providerMeta);
    console.log('createMetaData--------------------------',createMetaData)
    if (!createMetaData) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create Servicer account',
      });
    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      return res.send({
        code: constant.errorCode,
        message: 'Email already exists',
      });
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      password: hashedPassword,
      accountId: createMetaData._id,
    };

    // Create the user
    const createDealer = await userService.createUser(userMetaData);
    if (createDealer) {
      return res.send({
        code: constant.successCode,
        message: 'Success',
      });
    }
  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
    });
  }
};


