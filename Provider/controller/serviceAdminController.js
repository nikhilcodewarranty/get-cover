const { serviceProvider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
const providerService = require("../services/providerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const role = require("../../User/model/role");
const userService = require("../../User/services/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const bcrypt = require("bcrypt");
const dealerService = require("../../Dealer/services/dealerService");
const mongoose = require('mongoose')

const randtoken = require('rand-token').generator()
//Created customer
exports.createServiceProvider = async (req, res, next) => {
  try {
    let data = req.body
    const count = await providerService.getServicerCount();

    let servicerObject = {
      name: data.accountName,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: true,
      accountStatus: "Approved",
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    }

    if (data.flag == "create") {

      let checkAccountName = await providerService.getServicerByName({ name: data.accountName }, {});
      if (checkAccountName) {
        res.send({
          code: constant.errorCode,
          message: "Servicer already exist with this account name"
        })
        return;
      };

      let checkPrimaryEmail = await userService.findOneUser({ email: data.email });
      if (checkPrimaryEmail) {
        res.send({
          code: constant.errorCode,
          message: "User already exist with this email "
        })
        return;
      }
    //  data.members[0].status = true
      let teamMembers = data.members

      const createServiceProvider = await providerService.createServiceProvider(servicerObject);
      console.log('check for create+++++++++++++++++++++=', createServiceProvider)
      if (!createServiceProvider) {
        res.send({
          code: constant.errorCode,
          message: "Unable to create the servicer"
        })
        return;
      };

      teamMembers = teamMembers.map(member => ({ ...member, accountId: createServiceProvider._id, metaId: createServiceProvider._id, approvedStatus: "Approved", roleId: "65719c8368a8a86ef8e1ae4d" }));

      let saveMembers = await userService.insertManyUser(teamMembers)
      let resetPasswordCode = randtoken.generate(4, '123456789')
      let checkPrimaryEmail1 = await userService.updateSingleUser({ email: data.email, isPrimary: true }, { resetPasswordCode: resetPasswordCode }, { new: true });

      let resetLink = `http://15.207.221.207/newPassword/${checkPrimaryEmail1._id}/${resetPasswordCode}`
      const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail1.email, { link: resetLink }))
      res.send({
        code: constant.successCode,
        message: "Customer created successfully",
        result: data
      })
      return
    }

    if (data.flag == "approve") {

      let checkDetail = await providerService.getServicerByName({ _id: data.providerId })
      if (!checkDetail) {
        res.send({
          code: constant.errorCode,
          message: "Invalid ID"
        })
        return;
      }
      if (servicerObject.name != data.oldName) {
        let checkAccountName = await providerService.getServicerByName({ name: data.accountName }, {});
        if (checkAccountName) {
          res.send({
            code: constant.errorCode,
            message: "Servicer already exist with this account name"
          })
          return;
        };
      }
      if (data.email != data.oldEmail) {
        let emailCheck = await userService.findOneUser({ email: data.email });
        if (emailCheck) {
          res.send({
            code: constant.errorCode,
            message: "Primary user email already exist"
          })
          return;
        }
      }

      let teamMembers = data.members


      // console.log("getUserId================",getUserId);
      // return;

      const updateServicer = await providerService.updateServiceProvider({ _id: checkDetail._id }, servicerObject);

      if (!updateServicer) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the servicer"
        })
        return;
      };
      let resetPasswordCode = randtoken.generate(4, '123456789')
      // let getUserId = await userService.updateSingleUser({ accountId: checkDetail._id, isPrimary: true }, { resetPasswordCode: resetPasswordCode }, { new: true })  // to String to object
      let getUserId = await userService.updateSingleUser({ accountId: checkDetail._id, isPrimary: true }, { resetPasswordCode: resetPasswordCode }, { new: true })
      teamMembers = teamMembers.slice(1).map(member => ({ ...member, accountId: updateServicer._id,metaId: updateServicer._id ,approvedStatus: "Approved", status: true }));
      if (teamMembers.length > 0) {
        let saveMembers = await userService.insertManyUser(teamMembers)
      }
      let resetLink = `http://15.207.221.207/newPassword/${getUserId._id}/${resetPasswordCode}`
      const mailing = sgMail.send(emailConstant.servicerApproval(getUserId.email, { link: resetLink }))
      res.send({
        code: constant.successCode,
        message: "Approve successfully",
        result: data
      })
      return;
    }



  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.approveServicer = async (req, res, next) => {
  try {
    let data = req.body
    let servicerObject = {
      name: data.accountName,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      accountStatus: "Approved",
    }


    let checkDetail = await providerService.getServicerByName({ _id: req.params.servicerId })
    if (!checkDetail) {
      res.send({
        code: constant.errorCode,
        message: "Invalid ID"
      })
      return;
    }
    if (servicerObject.name != data.oldName) {
      let checkAccountName = await providerService.getServicerByName({ name: data.accountName }, {});
      if (checkAccountName) {
        res.send({
          code: constant.errorCode,
          message: "Servicer already exist with this account name"
        })
        return;
      };
    }
    if (data.email != data.oldEmail) {
      let emailCheck = await userService.findOneUser({ email: data.email });
      if (emailCheck) {
        res.send({
          code: constant.errorCode,
          message: "Primary user email already exist"
        })
        return;
      }
    }

    let teamMembers = data.members
    // to string to object 
    let getUserId = await userService.findOneUser({ accountId: checkDetail._id, isPrimary: true }, {})
    // console.log("getUserId================",getUserId);
    // return;

    const updateServicer = await providerService.updateServiceProvider({ _id: checkDetail._id }, servicerObject);
    if (!updateServicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the servicer"
      })
      return;
    };

    teamMembers = teamMembers.map(member => ({ ...member, accountId: updateServicer._id, roleId: '65719c8368a8a86ef8e1ae4d' }));

    let saveMembers = await userService.insertManyUser(teamMembers)
    let resetPasswordCode = randtoken.generate(4, '123456789')

    let resetLink = `http://15.207.221.207/newPassword/${getUserId._id}/${resetPasswordCode}`
    const mailing = sgMail.send(emailConstant.servicerApproval(data.email, { link: resetLink }))
    res.send({
      code: constant.successCode,
      message: "Approve successfully",
      result: data
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

// get servicer registration request
exports.getServicer = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false, accountStatus: req.params.status }
    let projection = { __v: 0, isDeleted: 0 }
    let servicer = await providerService.getAllServiceProvider(query, projection);
    //-------------Get All servicer Id's------------------------

    const servicerIds = servicer.map(obj => obj._id);
    // Get Dealer Primary Users from colection
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getMembers(query1, projection)

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
        return servicerData.toObject();
      }
    });

    const nameRegex = new RegExp(data.name ? data.name.trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.servicerData.name) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      data: filteredData
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get servicer by ID
exports.getServiceProviderById = async (req, res, next) => {
  try {
    const singleServiceProvider = await providerService.getServiceProviderById({ _id: req.params.servicerId });
    if (!singleServiceProvider) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the details"
      })
      return;
    };
    let getMetaData = await userService.findOneUser({ accountId: singleServiceProvider._id, isPrimary: true })
    let resultUser = getMetaData.toObject()
    resultUser.meta = singleServiceProvider
    res.send({
      code: constant.successCode,
      message: resultUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// reject servicer request
exports.rejectServicer = async (req, res) => {
  try {
    let data = req.body
    let checkServicer = await providerService.deleteServicer({ _id: req.params.servicerId })
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the servicer"
      })
      return;
    };
    let deleteUser = await userService.deleteUser({ accountId: checkServicer._id })
    res.send({
      code: constant.successCode,
      message: "Deleted"
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//edit servicer details
exports.editServicerDetail = async (req, res) => {
  try {
    let data = req.body
    let checkServicer = await providerService.getServiceProviderById({ _id: req.params.servicerId })
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return;
    }
    if (data.name != data.oldName) {
      let checkName = await providerService.getServicerByName({ name: new RegExp(data.name) }, {})
      if (checkName) {
        res.send({
          code: constant.errorCode,
          message: "Servicer already exist with this name"
        })
        return;
      };
    }


    let criteria = { _id: checkServicer._id }
    let updateData = await providerService.updateServiceProvider(criteria, data)
    if (!updateData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
      return;
    }
    let criteria1 = {
      $and: [
        { _id: data.userId },
        { accountId: checkServicer._id }
      ]
    }
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result: updateData
    })
    // let updateMetaData = await userService.updateSingleUser(criteria1, data, { new: true })
    // if (!updateMetaData) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Unable to update the primary details"
    //   })
    // } else {
    //   res.send({
    //     code: constant.successCode,
    //     message: "Updated Successfully",
    //     result: { updateData, updateMetaData }
    //   })
    // }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateStatus = async (req, res) => {
  try {
    let data = req.body
    let checkServicer = await providerService.getServiceProviderById({ _id: req.params.servicerId })
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return;
    }
    let criteria = { _id: checkServicer._id }
    let updateData = await providerService.updateServiceProvider(criteria, data)
    if (!updateData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
      return;
    }
    if (data.status == "false" || !data.status) {
      let criteria1 = { accountId: checkServicer._id }
      let updateMetaData = await userService.updateUser(criteria1, { status: data.status }, { new: true })
      if (!updateMetaData) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the primary details 'false'"
        })
      } else {
        res.send({
          code: constant.successCode,
          message: "Updated Successfully 'false'",
          result: { updateData, updateMetaData }
        })
      }
    } else {
      let criteria1 = { accountId: checkServicer._id, isPrimary: true }
      let updateMetaData = await userService.updateSingleUser(criteria1, { status: data.status }, { new: true })
      if (!updateMetaData) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the primary details"
        })
      } else {
        res.send({
          code: constant.successCode,
          message: "Updated Successfully",
          result: { updateData, updateMetaData }
        })
      }
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

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

    let servicerUser = await userService.getMembers(query1, projection)

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

exports.deleteServiceProvider = async (req, res, next) => {
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

    // Check if the dealer already exists
    const existingServicer = await providerService.getServicerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') }, accountStatus: "Pending" }, { isDeleted: 0, __v: 0 });
    if (existingServicer) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this name! Waiting for the approval"
      })
      return;
    }

    const existingServicer2 = await providerService.getServicerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingServicer2) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this name!"
      })
      return;
    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });
    if (existingUser) {
      const existingServicer3 = await providerService.getServicerByName({ _id: existingUser.accountId }, { isDeleted: 0, __v: 0 });
      console.log(existingUser, existingServicer3)
      if (existingServicer3) {
        if (existingServicer3.accountStatus == "Pending") {
          res.send({
            code: constant.errorCode,
            message: "You have registered already with this email! Waiting for the approval"
          })
          return;
        }

      }

      // const existingServicer = await providerService.getServicerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') }, accountStatus: "Pending" }, { isDeleted: 0, __v: 0 });
      // if(existingServicer){
      //   if(existingServicer.accountStatus == "Pending"){
      //     res.send({
      //       code: constant.errorCode,
      //       message: "You have registered already with this email!"
      //     })
      //     return;
      //   }
      // }
      res.send({
        code: constant.errorCode,
        message: "You have already registered  with this email!"
      })
      return;
    }

    const count = await providerService.getServicerCount();
    // console.log("CountServicer++++++++",count);return;
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
      roleId: "65719c8368a8a86ef8e1ae4d",
      accountId: createMetaData._id,
      metaId: createMetaData._id,
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
    let mailing = sgMail.send(emailConstant.servicerWelcomeMessage(data.email))

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

// status update for servicer 
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

    if (req.body.status == false) {
      let criteria1 = { accountId: updatedResult._id }
      let option = { new: true }
      let updateUsers = await userService.updateUser(criteria1, { status: req.body.status }, option)
      if (!updateUsers) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the users"
        })
        return
      }
      res.send({
        code: constant.successCode,
        message: "Updated Successfully",
      })
    } else {
      let criteria1 = { accountId: updatedResult._id, isPrimary: true }
      let option = { new: true }
      let updateUsers = await userService.updateUser(criteria1, { status: req.body.status }, option)
      if (!updateUsers) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the primary user"
        })
        return
      }
      res.send({
        code: constant.successCode,
        message: "Updated Successfully",
      })
    }

  }
  catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
    });
  }
};

//get servicer user list with filter
exports.getSerivicerUsers = async (req, res) => {
  try {
    let data = req.body
    let getUsers = await userService.findUser({ accountId: req.params.servicerId }, { isPrimary: -1 })
    if (!getUsers) {
      res.send({
        code: constant.errorCode,
        message: "No Users Found!"
      })
    } else {
      const emailRegex = new RegExp(data.email ? data.email : '', 'i')
      const firstNameRegex = new RegExp(data.firstName ? data.firstName : '', 'i')
      const lastNameRegex = new RegExp(data.lastName ? data.lastName : '', 'i')
      const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
      const filteredData = getUsers.filter(entry => {
        return (
          firstNameRegex.test(entry.firstName) &&
          lastNameRegex.test(entry.lastName) &&
          emailRegex.test(entry.email) &&
          phoneRegex.test(entry.phoneNumber)
        );
      });
      let getServicerStatus = await providerService.getServiceProviderById({ _id: req.params.servicerId }, { status: 1 })
      if (!getServicerStatus) {
        res.send({
          code: constant.errorCode,
          message: "Invalid servicer ID"
        })
        return;
      }
      res.send({
        code: constant.successCode,
        message: "Success",
        result: filteredData,
        servicerStatus: getServicerStatus.status
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// add servicer user 
exports.addServicerUser = async (req, res) => {
  try {
    let data = req.body
    let checkServicer = await providerService.getServiceProviderById({ _id: req.params.servicerId })
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return
    }
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "user already exist with this email"
      })
    } else {
      data.isPrimary = false
      data.accountId = checkServicer._id
      data.metaId = checkServicer._id
      let statusCheck;
      if (!checkServicer.accountStatus) {
        statusCheck = false
      } else {
        statusCheck = data.status

      }
      data.status = statusCheck
      data.roleId = '65719c8368a8a86ef8e1ae4d'
      let saveData = await userService.createUser(data)
      if (!saveData) {
        res.send({
          code: constant.errorCode,
          message: "Unable to add the user"
        })
        return;
      }
      res.send({
        code: constant.successCode,
        message: "Added successfully",
        result: saveData
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.createDeleteRelation = async (req, res) => {
  try {
    let data = req.body
    let checkServicer = await providerService.getServicerByName({ _id: req.params.servicerId }, {})
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return;
    }

    const trueArray = [];
    const falseArray = [];

    data.dealers.forEach(item => {
      if (item.status || item.status == "true") {
        trueArray.push(item);
      } else {
        falseArray.push(item);
      }
    });

    let uncheckId = falseArray.map(record => record._id)
    let checkId = trueArray.map(record => record._id)

    const existingRecords = await dealerRelationService.getDealerRelations({
      servicerId: new mongoose.Types.ObjectId(req.params.servicerId),
      dealerId: { $in: checkId }
    });

    // Step 2: Separate existing and non-existing servicer IDs
    const existingServicerIds = existingRecords.map(record => record.dealerId.toString());
    const newDealerIds = checkId.filter(id => !existingServicerIds.includes(id));


    // Step 3: Delete existing records
    let deleteExisted = await dealerRelationService.deleteRelations({
      servicerId: new mongoose.Types.ObjectId(req.params.servicerId),
      dealerId: { $in: uncheckId }
    });

    // Step 4: Insert new records
    const newRecords = newDealerIds.map(dealerId => ({
      servicerId: req.params.servicerId,
      dealerId: dealerId
    }));
    if (newRecords.length > 0) {

      let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
      res.send({
        code: constant.successCode,
        message: "success"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "success"
      })
    }

    // for (let i = 0; i < data.servicers.length; i++) {
    //   let servicer = data.servicers[i]
    //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.params.dealerId })
    //   if (!checkRelation) {

    //   } else {

    //   }
    // }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getServicerDealers = async (req, res) => {
  try {
    let data = req.body
    let getDealersIds = await dealerRelationService.getDealerRelations({ servicerId: req.params.servicerId })
    if (!getDealersIds) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the dealers"
      })
      return;
    };
    let ids = getDealersIds.map((item) => item.dealerId)
    let dealers = await dealerService.getAllDealers({ _id: { $in: ids } }, {})

    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    // return false;

    let dealarUser = await userService.getMembers({ accountId: { $in: ids }, isPrimary: true }, {})
    const result_Array = dealarUser.map(item1 => {
      const matchingItem = dealers.find(item2 => item2._id.toString() === item1.accountId.toString());

      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          dealerData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    const emailRegex = new RegExp(data.email ? data.email : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name : '', 'i')
    const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.dealerData.name) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });

    res.send({
      code: constant.successCode,
      data: filteredData
    });


  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerList = async (req, res) => {
  try {
    let data = req.body
    let query = { isDeleted: false, status: "Approved", accountStatus: true }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(query, projection);

    let getRelations = await dealerRelationService.getDealerRelations({ servicerId: req.params.servicerId })

    const resultArray = dealers.map(item => {
      const matchingDealer = getRelations.find(dealer => dealer.dealerId.toString() == item._id.toString());
      const documentData = item._doc;
      return { ...documentData, check: !!matchingDealer };
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      result: resultArray
    });


  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}




