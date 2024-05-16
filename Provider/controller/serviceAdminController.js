const { serviceProvider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
const providerService = require("../services/providerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const role = require("../../User/model/role");
const claimService = require("../../Claim/services/claimService");
const LOG = require('../../User/model/logs')

const userService = require("../../User/services/userService");
const moment = require("moment");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const bcrypt = require("bcrypt");
const dealerService = require("../../Dealer/services/dealerService");
const mongoose = require('mongoose')
const supportingFunction = require('../../config/supportingFunction')

require("dotenv").config();
const randtoken = require('rand-token').generator()
//Created customer
exports.createServiceProvider = async (req, res, next) => {
  try {
    let data = req.body
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
    const count = await providerService.getServicerCount();
    let servicerObject = {
      name: data.accountName,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      isAccountCreate: data.status,
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
      if (!createServiceProvider) {
        //Save Logs
        let logData = {
          userId: req.userId,
          endpoint: "createServiceProvider",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Unable to create the servicer",
            result: createServiceProvider
          }
        }

        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Unable to create the servicer"
        })
        return;
      };
      teamMembers = teamMembers.map(member => ({ ...member, accountId: createServiceProvider._id, metaId: createServiceProvider._id, approvedStatus: "Approved", roleId: "65719c8368a8a86ef8e1ae4d" }));
      let saveMembers = await userService.insertManyUser(teamMembers)

      if (data.status) {
        console.log("saveMembers------------------------------", saveMembers);
        for (let i = 0; i < saveMembers.length; i++) {
          if (saveMembers[i].status) {
            let email = saveMembers[i].email
            let userId = saveMembers[i]._id
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
            let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
            const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink, role: req.role, servicerName: data.accountName }))
          }

        }
        // let resetPrimaryCode = randtoken.generate(4, '123456789')
        // let checkPrimaryEmail1 = await userService.updateSingleUser({ email: data.email, isPrimary: true }, { resetPasswordCode: resetPrimaryCode }, { new: true });

        // let resetLink = `http://15.207.221.207/newPassword/${checkPrimaryEmail1._id}/${resetPrimaryCode}`
        // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail1.email, { link: resetLink }))
      }
      let IDs = await supportingFunction.getUserIds()
      //Send Notification to ,admin,,servicer 
      IDs.push(createServiceProvider._id)

      let notificationData = {
        title: "Servicer Account Creation",
        description: data.accountName + " " + "servicer account has been created successfully!",
        userId: createServiceProvider._id,
        flag: 'servicer',
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);

      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "createServiceProvider",
        body: data,
        response: {
          code: constant.successCode,
          message: "Servicer created successfully",
          result: createServiceProvider
        }
      }

      await LOG(logData).save()

      res.send({
        code: constant.successCode,
        message: "Servicer created successfully",
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

      data.isAccountCreate = data.status

      let teamMembers = data.members
      // console.log("getUserId================",getUserId);
      // return;

      const updateServicer = await providerService.updateServiceProvider({ _id: checkDetail._id }, servicerObject);
      if (!updateServicer) {
        //Save Logs
        let logData = {
          userId: req.userId,
          endpoint: "createServiceProvider",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Unable to update the servicer"
          }
        }

        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Unable to update the servicer"
        })
        return;
      };



      let primaryEmail = teamMembers[0].email
      let primaryCode = randtoken.generate(4, '123456789')
      let updatePrimaryCode = await userService.updateSingleUser({ email: primaryEmail }, { resetPasswordCode: primaryCode, status: data.status ? true : false }, { new: true });
      let updatePrimaryLInk = `${process.env.SITE_URL}newPassword/${updatePrimaryCode._id}/${primaryCode}`
      // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink }))
      const mailing = sgMail.send(emailConstant.servicerApproval(updatePrimaryCode.email, { link: updatePrimaryLInk, role: req.role, servicerName: data?.accountName }))
      // let getUserId = await userService.updateSingleUser({ accountId: checkDetail._id, isPrimary: true }, { resetPasswordCode: resetPasswordCode }, { new: true })  // to String to object
      //let getUserId = await userService.updateSingleUser({ accountId: checkDetail._id, isPrimary: true }, { resetPasswordCode: resetPasswordCode }, { new: true })
      teamMembers = teamMembers.slice(1).map(member => ({ ...member, accountId: updateServicer._id, metaId: updateServicer._id, approvedStatus: "Approved", status: true }));
      if (teamMembers.length > 0) {
        let saveMembers = await userService.insertManyUser(teamMembers)
        if (data.status) {
          for (let i = 0; i < saveMembers.length; i++) {
            if (saveMembers[i].status) {
              let email = saveMembers[i].email
              let userId = saveMembers[i]._id
              let resetPasswordCode = randtoken.generate(4, '123456789')
              let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
              let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
              // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink }))
              const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink, role: req.role, servicerName: data?.accountName }))

            }

          }
        }
      }
      // if (data.status) {
      //   let resetPrimaryCode = randtoken.generate(4, '123456789')
      //   let checkPrimaryEmail1 = await userService.updateSingleUser({ email: data.email, isPrimary: true }, { resetPasswordCode: resetPrimaryCode }, { new: true });
      //   let resetLink = `http://15.207.221.207/newPassword/${getUserId._id}/${resetPrimaryCode}`
      //   const mailing = sgMail.send(emailConstant.servicerApproval(getUserId.email, { link: resetLink }))
      // }
      let IDs = await supportingFunction.getUserIds()
      //Send Notification to ,admin,,servicer 
      IDs.push(data.providerId)

      let notificationData = {
        title: "Servicer Account Approved",
        description: data.accountName + " " + "servicer account has been approved successfully!",
        userId: data.providerId,
        flag: 'servicer',
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "createServiceProvider",
        body: data,
        response: {
          code: constant.successCode,
          message: "Approve successfully",
          result: data
        }
      }

      await LOG(logData).save()

      res.send({
        code: constant.successCode,
        message: "Approve successfully",
        result: data
      })
      return;
    }



  } catch (error) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "createServiceProvider catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: error.message
      }
    }

    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.approveServicer = async (req, res, next) => {
  try {
    let data = req.body
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
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

    let resetLink = `${process.env.SITE_URL}newPassword/${getUserId._id}/${resetPasswordCode}`
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

    // Get servicer with claim
    const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: { $ne: "Rejected" } };

    const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "Completed" };

    let valueClaim = await claimService.getServicerClaimsValue(servicerCompleted, "$servicerId");
    let numberOfClaims = await claimService.getServicerClaimsNumber(servicerClaimsIds, "$servicerId");

    const result_Array = servicerUser.map(item1 => {
      const matchingItem = servicer.find(item2 => item2._id.toString() === item1.accountId.toString());
      const claimValue = valueClaim.find(claim => claim._id.toString() === item1.accountId.toString())
      const claimNumber = numberOfClaims.find(claim => claim._id.toString() === item1.accountId.toString())
      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: matchingItem.toObject(),
          claimValue: claimValue ? claimValue : 0,
          claimNumber: claimNumber ? claimNumber : 0
        };
      } else {
        return servicerData.toObject();
      }
    });

    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

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

    let valueClaim = await claimService.getDashboardData({ claimFile: 'Completed', servicerId: new mongoose.Types.ObjectId(req.params.servicerId) });
    let numberOfClaims = await claimService.getClaims({ claimFile: { $ne: "Rejected" }, servicerId: new mongoose.Types.ObjectId(req.params.servicerId) });
    const claimData = {
      numberOfClaims: numberOfClaims.length,
      valueClaim: valueClaim[0]?.totalAmount
    }
    resultUser.meta = singleServiceProvider
    resultUser.claimData = claimData
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
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "/rejectServicer/:servicerId catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }

    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//edit servicer details (Log)
exports.editServicerDetail = async (req, res) => {
  try {
    let data = req.body
    data.name = data.name.trim().replace(/\s+/g, ' ');
    data.oldName = data.oldName.trim().replace(/\s+/g, ' ');
    let checkServicer = await providerService.getServiceProviderById({ _id: req.params.servicerId })
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return;
    }
    if (data.name != data.oldName) {
      let regex = new RegExp('^' + data.name + '$', 'i');
      let checkName = await providerService.getServicerByName({ name: regex }, {})
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
    let servicerUserCreateria = { accountId: req.params.servicerId };
    // let newValue = {
    //   $set: {
    //     status: false
    //   }
    // };
    // if (data.isAccountCreate) {
    //   servicerUserCreateria = { accountId: req.params.servicerId, isPrimary: true };
    //   newValue = {
    //     $set: {
    //       status: true
    //     }
    //   };
    // }
    // const changeServicerUser = await userService.updateUser(servicerUserCreateria, newValue, { new: true });
    if (!updateData) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "/editServicerDetail/:servicerId",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the data",
          result: changeServicerUser
        }
      }

      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
      return;
    }
    // let criteria1 = {
    //   $and: [
    //     { _id: data.userId },
    //     { accountId: checkServicer._id }
    //   ]
    // }

    //send notification to admin and servicer
    let IDs = await supportingFunction.getUserIds()
    //const dealer = await dealerService.getDealerById(checkUser.accountId, {})
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.params.servicerId, isPrimary: true })
    IDs.push(getPrimary._id)
    let notificationData = {
      title: "Servicer Detail Update",
      description: "The servicer information has been changed!",
      userId: req.params.customerId,
      flag: "Servicer",
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "/editServicerDetail/:servicerId",
      body: data,
      response: {
        code: constant.successCode,
        message: "Updated Successfully",
        result: updateData
      }
    }

    await LOG(logData).save()

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
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "/editServicerDetail/:servicerId catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }

    await LOG(logData).save()

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
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "/updateStatus/:servicerId",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the data",
          result: updateData
        }
      }

      await LOG(logData).save()

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
        //Save Logs
        let logData = {
          userId: req.userId,
          endpoint: "/updateStatus/:servicerId",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Unable to update the primary details 'false'",
            result: updateMetaData
          }
        }

        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Unable to update the primary details 'false'"
        })
      } else {
        //Send notification to servicer and admin
        let IDs = await supportingFunction.getUserIds()
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.params.servicerId, isPrimary: true })
        IDs.push(getPrimary._id)
        let notificationData = {
          title: "Servicer status update",
          description: checkServicer.name + " , " + "your status has been updated",
          userId: req.params.servicerId,
          flag: 'servicer',
          notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);
        //Save Logs
        let logData = {
          userId: req.userId,
          endpoint: "/updateStatus/:servicerId",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Updated Successfully",
            result: updateData
          }
        }

        await LOG(logData).save()

        res.send({
          code: constant.successCode,
          message: "Updated Successfully 'false'",
          result: { updateData, updateMetaData }
        })
      }
    } else {
      if (checkServicer.isAccountCreate) {
        let criteria1 = { accountId: checkServicer._id, isPrimary: true }
        let updateMetaData = await userService.updateSingleUser(criteria1, { status: data.status }, { new: true })
        if (!updateMetaData) {
          res.send({
            code: constant.errorCode,
            message: "Unable to update the primary details"
          })
        }
        else {
          res.send({
            code: constant.successCode,
            message: "Updated Successfully 'false'",
            result: { updateData, updateMetaData }
          })
        }
      }
    }
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "/updateStatus/:servicerId",
      body: data,
      response: {
        code: constant.successCode,
        message: "Updated Successfully",
        result: updateData
      }
    }

    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result: updateData
    })

  } catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "updateStatus/:servicerId catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }

    await LOG(logData).save()

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

    let IDs = await supportingFunction.getUserIds()


    const notificationData = {
      title: "New Servicer Registration",
      description: data.name + " " + "has finished registering as a new servicer. For the onboarding process to proceed more quickly, kindly review and give your approval.",
      userId: createMetaData._id,
      flag: 'servicer',
      notificationFor: IDs
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
    let emailData = {
      dealerName: ServicerMeta.name,
      c1: "Thank you for",
      c2: "Registering as a",
      c3: "Your account is currently pending approval from our admin.",
      c4: "Once approved, you will receive a confirmation emai",
      c5: "We appreciate your patience.",
      role: "Servicer!"
    }

    // Send Email code here
    let mailing = sgMail.send(emailConstant.dealerWelcomeMessage(data.email, emailData))
    let logData = {
      userId: req.teammateId,
      endpoint: "servicer/register",
      body: data,
      response: {
        code: constant.successCode,
        message: "registered Successfully",
        data: data
      }
    }

    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      data: createMetaData,
    });
  } catch (err) {
    let logData = {

      endpoint: "servicer/register",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await LOG(logData).save()
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
      const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
      const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
      const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
      const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
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
        servicerStatus: getServicerStatus.status,
        isAccountCreate: getServicerStatus.isAccountCreate

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
    let checkUser = await userService.getUserById1({ accountId: req.params.servicerId, isPrimary: true }, { isDeleted: false })
    data.status = checkUser.status ? true : false;
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
        //Save Logs
        let logData = {
          userId: req.userId,
          endpoint: "/addServicerUser/:servicerId",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Unable to add the user"
          }
        }

        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Unable to add the user"
        })
        return;
      }
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "/addServicerUser/:servicerId",
        body: data,
        response: {
          code: constant.successCode,
          message: "Added successfully",
          result: saveData
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "Added successfully",
        result: saveData
      })
    }
  } catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "/addServicerUser/:servicerId catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }

    await LOG(logData).save()

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

    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber.replace(/\s+/g, ' ').trim() : '', 'i')

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

exports.getServicerClaims = async (req, res) => {
  try {
    // if (req.role != 'Super Admin') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Only super admin allow to do this action'
    //   });
    //   return;
    // }
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let checkServicer = await providerService.getServicerByName({ _id: req.params.servicerId }, {})
    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid servicer ID"
      })
      return;
    }
    let newQuery = [];
    newQuery.push({
      $facet: {
        totalRecords: [
          {
            $count: "total"
          }
        ],
        data: [
          {
            $skip: skipLimit
          },
          {
            $limit: pageLimit
          },
          {
            $lookup: {
              from: "servicer_dealer_relations",
              localField: "contracts.orders.dealers._id",
              foreignField: "dealerId",
              as: "contracts.orders.dealers.dealerServicer",
            }
          },
          {
            $lookup: {
              from: "resellers",
              localField: "contracts.orders.resellerId",
              foreignField: "_id",
              as: "contracts.orders.resellers",
            }
          },
          {
            $lookup: {
              from: "serviceproviders",
              localField: "contracts.orders.servicerId",
              foreignField: "_id",
              as: "contracts.orders.servicers",
            }
          },
          {
            $project: {
              "contractId": 1,
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.serial": 1,
              "contracts.orders.dealerId": 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.serviceCoverageType": 1,
              "contracts.orders.coverageType": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.dealers.isShippingAllowed": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": 1,
              "contracts.orders.dealers.dealerServicer": {
                $map: {
                  input: "$contracts.orders.dealers.dealerServicer",
                  as: "dealerServicer",
                  in: {
                    "_id": "$$dealerServicer._id",
                    "servicerId": "$$dealerServicer.servicerId",
                  }
                }
              },
              "contracts.orders.servicers": {
                $map: {
                  input: "$contracts.orders.servicers",
                  as: "servicer",
                  in: {
                    "_id": "$$servicer._id",
                    "name": "$$servicer.name",
                  }
                }
              },
              "contracts.orders.resellers": {
                $map: {
                  input: "$contracts.orders.resellers",
                  as: "reseller",
                  in: {
                    "_id": "$$reseller._id",
                    "name": "$$reseller.name",
                    "isServicer": "$$reseller.isServicer"
                  }
                }
              }
            }
          },

        ]
      }
    })
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'servicerId': new mongoose.Types.ObjectId(req.params.servicerId) },
          ]
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },
      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.isDeleted": false },
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $lookup: {
          from: "customers",
          localField: "contracts.orders.customerId",
          foreignField: "_id",
          as: "contracts.orders.customer",

        }
      },
      {
        $unwind: "$contracts.orders.customer"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },

    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }

    let allClaims = await claimService.getAllClaims(lookupQuery);

    let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

    let allServicerIds = [];
    // Iterate over the data array
    resultFiter.forEach(item => {
      // Iterate over the dealerServicer array in each item
      item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
        // Push the servicerId to the allServicerIds array
        allServicerIds.push(dealer.servicerId);
      });
    });

    //Get Dealer and Reseller Servicers
    // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    let servicerName = '';
    // console.log("servicerIds=================", allServicerIds);
    // res.json(resultFiter)
    // return
    allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers)
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })
    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// Mark as paid claims
exports.paidUnpaid = async (req, res) => {
  try {
    let data = req.body
    let claimId = data.claimIds
    let queryIds = { _id: { $in: claimId } };
    const updateBulk = await claimService.markAsPaid(queryIds, { claimPaymentStatus: 'Paid' }, { new: true })
    if (!updateBulk) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update!'
      })
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateBulk
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }


}

exports.paidUnpaidClaim = async (req, res) => {
  try {
    let data = req.body
    let dateQuery = {}
    if (data.noOfDays) {
      const end = moment().startOf('day')
      const start = moment().subtract(data.noOfDays, 'days').startOf('day')
      console.log(end, start)
      dateQuery = {
        claimDate: {
          $gte: new Date(start),
          $lte: new Date(end),
        }
      }
    }
    const flag = req.body.flag == 1 ? 'Paid' : 'Unpaid'
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let servicerId = req.params.servicerId
    let match = {};
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
      servicerId = req.userId
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    let newQuery = [];
    newQuery.push({
      $facet: {
        totalRecords: [
          {
            $count: "total"
          }
        ],
        data: [
          {
            $skip: skipLimit
          },
          {
            $limit: pageLimit
          },
          {
            $lookup: {
              from: "servicer_dealer_relations",
              localField: "contracts.orders.dealers._id",
              foreignField: "dealerId",
              as: "contracts.orders.dealers.dealerServicer",
            }
          },
          {
            $lookup: {
              from: "resellers",
              localField: "contracts.orders.resellerId",
              foreignField: "_id",
              as: "contracts.orders.resellers",
            }
          },
          {
            $project: {
              "contractId": 1,
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimDate: 1,
              claimStatus: 1,
              claimPaymentStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.serial": 1,
              "contracts.orders.dealerId": 1,
              trackingNumber: 1,
              trackingType: 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": 1,
              "contracts.orders.dealers.dealerServicer": {
                $map: {
                  input: "$contracts.orders.dealers.dealerServicer",
                  as: "dealerServicer",
                  in: {
                    "_id": "$$dealerServicer._id",
                    "servicerId": "$$dealerServicer.servicerId",
                  }
                }
              },
              "contracts.orders.servicers": {
                $map: {
                  input: "$contracts.orders.servicers",
                  as: "servicer",
                  in: {
                    "_id": "$$servicer._id",
                    "name": "$$servicer.name",
                  }
                }
              },
              "contracts.orders.resellers": {
                $map: {
                  input: "$contracts.orders.resellers",
                  as: "reseller",
                  in: {
                    "_id": "$$reseller._id",
                    "name": "$$reseller.name",
                    "isServicer": "$$reseller.isServicer"
                  }
                }
              }
            }
          },
        ]
      }
    })
    let servicerMatch = {}
    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer.length > 0) {
        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
        //  servicerMatch = { 'servicerId': { $in: servicerIds } }
        servicerMatch = {
          $or: [
            { "servicerId": { $in: servicerIds } },
            { "servicerId": { $in: dealerIds } },
            { "servicerId": { $in: resellerIds } }
          ]
        };
      }
      else {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
      }
    }
    // if (data.servicerName != '' && data.servicerName != undefined) {
    //   const checkServicer = await providerService.getServiceProviderById({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
    //   if (checkServicer) {
    //     servicerMatch = { 'servicerId': new mongoose.Types.ObjectId(checkServicer._id) }
    //   }
    //   else {
    //     servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
    //   }
    // }

    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': 'Completed' },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { claimPaymentStatus: flag },
            dateQuery,
            { 'servicerId': new mongoose.Types.ObjectId(servicerId) }
          ]
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.isDeleted": false },
            match
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $match:
        {
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
          // "contracts.orders.dealers.isDeleted": false,
        }
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "contracts.orders.servicerId",
          foreignField: "_id",
          as: "contracts.orders.servicers",
        }
      },
      {
        $lookup: {
          from: "customers",
          localField: "contracts.orders.customerId",
          foreignField: "_id",
          as: "contracts.orders.customer",
        }
      },
      {
        $unwind: "$contracts.orders.customer"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },
    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getAllClaims(lookupQuery);

    let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

    let allServicerIds = [];
    // Iterate over the data array
    resultFiter.forEach(item => {
      // Iterate over the dealerServicer array in each item
      item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
        // Push the servicerId to the allServicerIds array
        allServicerIds.push(dealer.servicerId);
      });
    });

    //Get Dealer and Reseller Servicers
    // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    let servicerName = '';
    allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers[0]?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers[0])
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id?.toString() === item1.servicerId?.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        // selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
        //selfServicer = item1.servicerId.toString() === item1.servicerData?._id?.toString() && item1.servicerData?.isServicer ? true : false
        selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
        console.log("selfServicer------------------------------------", item1.servicerId)
        console.log("selfServicer------------------------------------", item1.servicerData?._id?.toString())
        console.log("selfServicer------------------------------------", item1.servicerData?._id?.toString())
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })
    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}



