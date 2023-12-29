const { serviceProvider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
const providerService = require("../services/providerService");
const role = require("../../User/model/role");
const userService = require("../../User/services/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const bcrypt = require("bcrypt");

exports.getAllServiceProviders = async (req, res, next) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false, status: "Approved" }
    let projection = { __v: 0, isDeleted: 0 }
    const serviceProviders = await providerService.getAllServiceProvider(query, projection);

    //console.log("serviceProviders==============================",serviceProviders)
    if (!serviceProviders) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    }

    const servicerIds = serviceProviders.map(obj => obj._id);
    // Get Dealer Primary Users from colection
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getServicerUser(query1, projection)

    if (!servicerUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    const result_Array = servicerUser.map(item1 => {
      const matchingItem = serviceProviders.find(item2 => item2._id.toString() === item1.accountId.toString());

      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    res.send({
      code: constant.successCode,
      data: result_Array
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// get servicer registration request
exports.getPendingServicer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false, status: "Pending" }
    let projection = { __v: 0, isDeleted: 0 }
    let servicer = await providerService.getAllServiceProvider(query, projection);
    //-------------Get All servicer Id's------------------------

    const servicerIds = servicer.map(obj => obj._id);
    // Get Dealer Primary Users from colection
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getServicerUser(query1, projection)

    if (!servicerUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    const result_Array = servicerUser.map(item1 => {
      const matchingItem = servicer.find(item2 => item2._id.toString() === item1.accountId.toString());

      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    res.send({
      code: constant.successCode,
      data: result_Array
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Created customer
exports.createServiceProvider = async (req, res, next) => {
  try {
    let data = req.body
    // console.log("data+++++++++++++++++++++++=",data)
    // return;
    let servicerObject = {
      username: data.accountName,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      accountStatus: "Approved",
    }

    let checkAccountName = await providerService.getServicerByName({ name: data.accountName }, {});
    if (checkAccountName) {
      res.send({
        code: constant.errorCode,
        message: "Servicer already exist with this account name"
      })
      return;
    };

    let teamMembers = data.members

    const createServiceProvider = await providerService.createServiceProvider(servicerObject);
    if (!createServiceProvider) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the servicer"
      })
      return;
    };

    teamMembers = teamMembers.map(member => ({ ...member, accountId: createServiceProvider._id }));

    let saveMembers = await userService.insertManyUser(teamMembers)
    res.send({
      code: constant.successCode,
      message: "Customer created successfully",
      result: data
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//
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

    // Check if the specified role exists
    // { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
    const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      })
      return;
    }

    // Check if the dealer already exists
    const existingServicer = await providerService.getServicerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingServicer) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this name! Waiting for the approval"
      })
      return;
    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this email! Waiting for the approval"
      })
      return;
    }

    const count = await providerService.getServicerCount();
    // Extract necessary data for dealer creation
    const ServicerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    };
    // Register the Servicer
    const createMetaData = await providerService.registerServiceProvider(ServicerMeta);
    if (!createMetaData) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to create Servicer account',
      });

      return;
    }

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      accountId: createMetaData._id,
    };

    // Create the user
    const createdUser = await userService.createUser(userMetaData);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to create servicer user',
      });
      return
    }
    //Send Notification to dealer 

    const notificationData = {
      title: "New Servicer Registration",
      description: data.name + " " + "has finished registering as a new servicer. For the onboarding process to proceed more quickly, kindly review and give your approval.",
      userId: createMetaData._id,
      flag: 'servicer'
    };

    // Create the user
    const createNotification = await userService.createNotification(notificationData);
    // if (!createNotification) {
    //   res.send({
    //     code:constant.errorCode,
    //     message:""
    //   })
    //   // Send Email code here
    // }
    let mailing = await sgMail.send(emailConstant.servicerWelcomeMessage(data.email))

    res.send({
      code: constant.successCode,
      data: createMetaData,
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return;
  }
};

exports.statusUpdate = async (req, res) => {
  if (req.role != "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only super admin allow to do this action"
    })
    return;
  }
  let data = req.body;
  let criteria = { _id: req.body.servicerId };
  let newValue = {
    $set: {
      status: req.body.status
    }
  };
  let option = { new: true };
  try {
    const updatedResult = await providerService.statusUpdate(criteria, newValue, option)
    if (!updatedResult) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer status"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      data: updatedResult
    })
  }
  catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
    });
  }
};


