const { serviceProvider } = require("../../models/Provider/serviceProvider");
const providerService = require("../../services/Provider/providerService");
const resellerService = require("../../services/Dealer/resellerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const role = require("../../models/User/role");
const claimService = require("../../services/Claim/claimService");
const maillogservice = require("../../services/User/maillogServices");

const LOG = require('../../models/User/logs')
const userService = require("../../services/User/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const dealerService = require("../../services/Dealer/dealerService");
const supportingFunction = require('../../config/supportingFunction');
const orderService = require("../../services/Order/orderService");
const moment = require("moment");
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const bcrypt = require("bcrypt");
const mongoose = require('mongoose')
require("dotenv").config();
const randtoken = require('rand-token').generator()


//Created customer
exports.createServiceProvider = async (req, res, next) => {
  try {
    let data = req.body

    console.log("data+++++++++++++++++++++++++", data)
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
    const count = await providerService.getServicerCount();
    const admin = await userService.getUserById1({ metaData: { $elemMatch: { metaId: new mongoose.Types.ObjectId(req.userId), isPrimary: true } } }, {})
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`

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

      teamMembers = teamMembers.map(member => ({
        ...member,
        metaId: createServiceProvider._id,
        metaData:
          [
            {
              firstName: member.firstName,
              lastName: member.lastName,
              metaId: createServiceProvider._id,
              roleId: "65719c8368a8a86ef8e1ae4d",
              position: member.position,
              dialCode: member.dialCode,
              phoneNumber: member.phoneNumber,
              status: member.status,
              isPrimary: member.isPrimary
            }
          ],
        approvedStatus: "Approved",

      })
      );
      const adminQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "servicerNotification.servicerAdded": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      let notificationEmails = adminUsers.map(user => user.email)

      let saveMembers = await userService.insertManyUser(teamMembers)
      // Primary User Welcoime email
      let settingData = await userService.getSetting({});
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        title: settingData[0]?.title,
        senderName: admin.metaData[0]?.firstName,
        content: "We are delighted to inform you that the servicer account for " + createServiceProvider.name + " has been created.",
        subject: "Servicer Account Created - " + createServiceProvider.name
      }

      // Send Email code here
      let mailing
      if (notificationEmails.length > 0) {
        mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
        maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

      }
      if (data.status) {
        for (let i = 0; i < saveMembers.length; i++) {
          if (saveMembers[i].metaData[0]?.status) {
            let email = saveMembers[i].email
            let userId = saveMembers[i]._id
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
            let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
            const mailing = await sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email,
              {
                flag: "Approved",
                link: resetLink,
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                title: settingData[0]?.title,
                subject: "Set Password",
                role: "Servicer",
                address: settingData[0]?.address,
                servicerName: saveMembers[i].metaData[0].firstName + " " + saveMembers[i].metaData[0].lastName

              }))
            let emailData = {
              flag: "Approved",
              link: resetLink,
              darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
              lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
              title: settingData[0]?.title,
              subject: "Set Password",
              role: "Servicer",
              address: settingData[0]?.address,
              servicerName: saveMembers[i].metaData[0].firstName + " " + saveMembers[i].metaData[0].lastName

            }
            maillogservice.createMailLogFunction(mailing, emailData, [checkPrimaryEmail2], process.env.servicer_approval)

          }

        }
      }
      //Send Notification to ,admin,,servicer 
      let notificationData = {
        title: "New Servicer Added",
        description: `A New Servicer ${createServiceProvider.name} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} on our portal`,
        userId: req.teammateId,
        flag: 'servicer',
        notificationFor: IDs,
        redirectionId: "servicerDetails/" + createServiceProvider._id,
        endPoint: base_url + "servicerDetails/" + createServiceProvider._id,
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
      // Save Setting for dealer
      const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
      let adminSetting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
      const adminDefaultSetting = {
        logoLight: adminSetting[0]?.logoLight,
        logoDark: adminSetting[0]?.logoDark,
        favIcon: adminSetting[0]?.favIcon,
        title: adminSetting[0]?.title,
        colorScheme: adminSetting[0]?.colorScheme,
        address: adminSetting[0]?.address,
        whiteLabelLogo: adminSetting[0]?.whiteLabelLogo,

        paymentDetail: adminSetting[0]?.paymentDetail,
        setDefault: 0,
        userId: createServiceProvider._id,
      }
      const saveSetting = await userService.saveSetting(adminDefaultSetting)



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

      let settingData = await userService.getSetting({});

      data.isAccountCreate = data.status
      let teamMembers = data.members
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

      const adminQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "servicerNotification.servicerAdded": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)

      let notificationEmails = adminUsers.map(user => user.email)

      let emailData = {
        senderName: admin.metaData[0]?.firstName,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        title: settingData[0]?.title,
        websiteSetting: settingData[0],
        content: "We are delighted to inform you that the servicer account for " + checkDetail.name + " has been created.",
        subject: "Servicer Account Approved - " + checkDetail.name
      }
      // Send Email code here
      let mailing
      if (notificationEmails.length > 0) {
        mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
        maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

      }

      let primaryEmail = teamMembers[0].email
      let primaryCode = randtoken.generate(4, '123456789')
      let checkPrimary = await userService.findOneUser({ email: data.email });
      let creteria = { email: primaryEmail, metaData: { $elemMatch: { metaId: checkPrimary.metaData[0].metaId } } }
      let updatePrimaryCode = await userService.updateSingleUser(creteria, {
        $set: {
          resetPasswordCode: primaryCode,
          'metaData.$.status': data.status || data.status == "true" ? true : false,
        }
      }, { new: true });

      let updatePrimaryLInk = `${process.env.SITE_URL}newPassword/${updatePrimaryCode._id}/${primaryCode}`
      mailing = await sgMail.send(emailConstant.servicerApproval(updatePrimaryCode.email,
        {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          flag: "Approved",
          subject: "Set Password",
          address: settingData[0]?.address,
          title: settingData[0]?.title,
          websiteSetting: settingData[0],
          link: updatePrimaryLInk, role: "Servicer",
          servicerName: updatePrimaryCode?.metaData[0].firstName
        }))
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        flag: "Approved",
        subject: "Set Password",
        address: settingData[0]?.address,
        title: settingData[0]?.title,
        websiteSetting: settingData[0],
        link: updatePrimaryLInk, role: "Servicer",
        servicerName: updatePrimaryCode?.metaData[0].firstName
      }
      maillogservice.createMailLogFunction(mailing, emailData, [updatePrimaryCode], process.env.servicer_approval)

      teamMembers = teamMembers.slice(1).map(member => ({
        ...member,
        metaData:
          [
            {
              firstName: member.firstName,
              lastName: member.lastName,
              metaId: updateServicer._id,
              roleId: "65719c8368a8a86ef8e1ae4d",
              position: member.position,
              dialCode: member.dialCode,
              phoneNumber: member.phoneNumber,
              status: true,
              isPrimary: member.isPrimary
            }
          ],
        approvedStatus: "Approved",

      })
      );
      if (teamMembers.length > 0) {
        let saveMembers = await userService.insertManyUser(teamMembers)
        if (data.status) {
          for (let i = 0; i < saveMembers.length; i++) {
            if (saveMembers[i].metaData[0].status) {
              let email = saveMembers[i].email
              let userId = saveMembers[i]._id
              let resetPasswordCode = randtoken.generate(4, '123456789')
              let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
              let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
              const mailing = await sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email,
                {
                  darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                  lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                  address: settingData[0]?.address,
                  title: settingData[0]?.title,
                  websiteSetting: settingData[0],
                  subject: "Set Password",
                  link: resetLink, role: 'Servicer',
                  servicerName: saveMembers[i].metaData[0].firstName + " " + saveMembers[i].metaData[0].lastName
                }))

            }

          }
        }
      }
      //Send Notification to ,admin,,servicer 
      let notificationData = {
        title: "New Servicer Added",
        description: `A New Servicer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName} on our portal`,
        userId: req.teammateId,
        flag: 'servicer',
        notificationFor: IDs,
        redirectionId: "servicerDetails/" + checkDetail._id,
        endPoint: base_url + "servicerDetails/" + checkDetail._id,
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

      // Save Setting for dealer
      const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
      let adminSetting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
      const adminDefaultSetting = {
        logoLight: adminSetting[0]?.logoLight,
        logoDark: adminSetting[0]?.logoDark,
        favIcon: adminSetting[0]?.favIcon,
        title: adminSetting[0]?.title,
        colorScheme: adminSetting[0]?.colorScheme,
        address: adminSetting[0]?.address,
        paymentDetail: adminSetting[0]?.paymentDetail,
        setDefault: 0,
        whiteLabelLogo: adminSetting[0]?.whiteLabelLogo,

        userId: data.providerId

      }
      const saveSetting = await userService.saveSetting(adminDefaultSetting)

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

//
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
    let getUserId = await userService.findOneUser({ metaId: checkDetail._id, isPrimary: true }, {})
    const updateServicer = await providerService.updateServiceProvider({ _id: checkDetail._id }, servicerObject);

    if (!updateServicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the servicer"
      })
      return;
    };

    teamMembers = teamMembers.map(member => ({ ...member, metaId: updateServicer._id, roleId: '65719c8368a8a86ef8e1ae4d' }));

    let saveMembers = await userService.insertManyUser(teamMembers)
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let resetLink = `${process.env.SITE_URL}newPassword/${getUserId._id}/${resetPasswordCode}`
    const mailing = await sgMail.send(emailConstant.servicerApproval(data.email, { subject: "Set Password", link: resetLink }))

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


    const servicerUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: { $in: servicerIds }, isPrimary: true } } }
          ]
        }
      },
      {
        $project: {
          email: 1,
          'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
          'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
          'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
          'position': { $arrayElemAt: ["$metaData.position", 0] },
          'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
          'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
          'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
          'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
          'status': { $arrayElemAt: ["$metaData.status", 0] },
          resetPasswordCode: 1,
          isResetPassword: 1,
          approvedStatus: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    if (!servicerUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    // Get servicer with claim
    const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: "completed" };
    const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "completed" };
    let claimAggregateQuery1 = [
      {
        $match: servicerCompleted
      },
      {
        "$group": {
          "_id": "$servicerId",
          "totalAmount": {
            "$sum": {
              "$sum": "$totalAmount"
            }
          },
        },
      },

    ]

    let valueClaim = await claimService.getClaimWithAggregate(claimAggregateQuery1);
    let claimAggregateQuery = [
      {
        $match: servicerClaimsIds
      },
      {
        $group: {
          _id: "$servicerId",
          noOfOrders: { $sum: 1 },
        }
      },
    ]

    let numberOfClaims = await claimService.getClaimWithAggregate(claimAggregateQuery);

    const result_Array = servicerUser.map(item1 => {
      const matchingItem = servicer.find(item2 => item2._id.toString() === item1.metaId.toString());
      const claimValue = valueClaim.find(claim => claim._id.toString() === item1.metaId.toString())
      const claimNumber = numberOfClaims.find(claim => claim._id.toString() === item1.metaId.toString())
      if (matchingItem) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: matchingItem.toObject(),
          claimValue: claimValue ? claimValue : 0,
          claimNumber: claimNumber ? claimNumber : 0
        };
      } else {
        return servicerData.toObject();
      }
    });

    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    // const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    //const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.servicerData.name)
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

    // let getMetaData = await userService.findOneUser({ metaId: singleServiceProvider._id, isPrimary: true })
    const getMetaData = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { metaId: singleServiceProvider._id, isPrimary: true } } }
          ]
        }
      },
      {
        $project: {
          email: 1,
          'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
          'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
          'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
          'position': { $arrayElemAt: ["$metaData.position", 0] },
          'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
          'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
          'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
          'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
          'status': { $arrayElemAt: ["$metaData.status", 0] },
          resetPasswordCode: 1,
          isResetPassword: 1,
          approvedStatus: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);
    let resultUser = getMetaData[0]

    let claimQueryAggregate = [
      {
        $match: { claimFile: 'completed', servicerId: new mongoose.Types.ObjectId(req.params.servicerId) }
      },
      {
        "$group": {
          "_id": "",
          "totalAmount": {
            "$sum": {
              "$sum": "$totalAmount"
            }
          },
        },
      },

    ]

    let valueClaim = await claimService.getClaimWithAggregate(claimQueryAggregate);
    let numberOfClaims = await claimService.getClaims({ claimFile: "completed", servicerId: new mongoose.Types.ObjectId(req.params.servicerId) });
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
      message: error.message
    })
  }
};

// reject servicer request
exports.rejectServicer = async (req, res) => {
  try {
    let data = req.body
    let getServicer = await providerService.getServiceProviderById({ _id: req.params.servicerId });
    let checkServicer = await providerService.deleteServicer({ _id: req.params.servicerId })
    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } })

    if (!checkServicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the servicer"
      })
      return;
    };
    //Send Notification to dealer 
    const adminQuery = {
      metaData: {
        $elemMatch: {
          roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
          status: true,
          "registerNotifications.servicerDisapproved": true,
        }
      },

    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })
    const IDs = adminUsers.map(user => user._id)
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })

    let deleteUser = await userService.deleteUser({ metaData: { $elemMatch: { metaId: getServicer._id } } })
    let notificationData = {
      title: "Servicer Rejected",
      description: `Request for the new Servicer ${getServicer.name} has been rejected by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      userId: req.teammateId,
      flag: 'servicer',
      endPoint: null,
      redirectionId: null,
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    let settingData = await userService.getSetting({});
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: getServicer.metaData[0]?.name,
      content: "Dear " + getServicer.name + ",\n\nWe regret to inform you that your registration as an authorized dealer has been rejected by our admin team. If you have any questions or require further assistance, please feel free to contact us.\n\nBest regards,\nAdmin Team",
      subject: "Rejection Account"
    }
    const notificationEmails = adminUsers.map(user => user._id)
    // Send Email code here
    if (notificationEmails.length > 0) {
      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
      maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }


    res.send({
      code: constant.successCode,
      message: "Deleted Successfully!"
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
    let mergedEmail;
    let settingData = await userService.getSetting({});
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

    //let servicerUserCreateria = { metaId: req.params.servicerId };
    let servicerUserCreateria = {
      'metaData.metaId': req.params.servicerId
    }

    let newValue = {
      $set: {
        'metaData.$.status': false,
      }
    };

    if (data.isAccountCreate) {
      servicerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } };
      newValue = {
        $set: {
          'metaData.$.status': true,
        }
      };
    }

    const changeServicerUser = await userService.updateUser(servicerUserCreateria, newValue, { new: true });

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

    //send notification to admin and servicer
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminUpdateServicerQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "servicerNotification.userUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          ]
        }
      },
    }
    const servicerUpdateServicerQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "servicerNotification.userUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(req.params.servicerId) },
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdateServicerQuery, { email: 1, metaData: 1 })
    let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerUpdateServicerQuery, { email: 1, metaData: 1 })
    const IDs = adminUsers.map(user => user._id)
    const servicerIds = servicerUsers.map(user => user._id)
    let notificationArray = []
    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } })
    let notificationEmails = adminUsers.map(user => user.email)
    let servicerEmail = servicerUsers.map(user => user.email)

    mergedEmail = notificationEmails.concat(servicerEmail)
    // let getPrimary = await supportingFunction.getPrimaryUser({ metaId: req.params.servicerId, isPrimary: true })
    if (adminUsers.length > 0) {
      let notificationData = {
        title: "Servicer Details Updated",
        description: `The details for the Servicer ${checkServicer.name} has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        endPoint: base_url + "servicerDetails/" + checkServicer._id,
        redirectionId: "servicerDetails/" + checkServicer._id,
        flag: "Servicer Details",
        notificationFor: IDs
      };
      notificationArray.push(notificationData)
    }
    if (servicerUsers.length > 0) {
      let notificationData = {
        title: "Details Update",
        description: `The details for your account has been changed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        endPoint: base_url + "servicer/user",
        redirectionId: "servicer/user",
        flag: "Servicer Details",
        notificationFor: servicerIds
      };
      notificationArray.push(notificationData)

    }

    let createNotification = await userService.saveNotificationBulk(notificationArray);
    // Send Email code here

    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: checkServicer?.name,
      content: "Information has been updated successfully! effective immediately.",
      subject: "Update Info"
    }
    let mailing
    if (notificationEmails.length > 0) {
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
      maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }
    if (servicerEmail.length > 0) {
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, ["noreply@getcover.com"], emailData))
      maillogservice.createMailLogFunction(mailing, emailData, servicerUsers, process.env.update_status)
    }
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

//Update status
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
    let resetPasswordCode = randtoken.generate(4, '123456789')

    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } })
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
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminUpdateStatusQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "servicerNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          ]
        }
      },
    }
    const servicerUpdateStatusQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "servicerNotification.servicerUpdate": true },
            // { status: true },
            { metaId: new mongoose.Types.ObjectId(req.params.servicerId) }
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdateStatusQuery, { email: 1, metaData: 1 })
    let notificationArray = []

    let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerUpdateStatusQuery, { email: 1, metaData: 1 })
    if (data.status == "false" || !data.status) {
      let criteria1 = { metaData: { $elemMatch: { metaId: checkServicer._id } } }

      let updateMetaData = await userService.updateUser(criteria1, {
        $set: {
          'metaData.$.status': data.status,
        }
      }, { new: true })

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
        //send notification to dealer,reseller,admin,customer
        const IDs = adminUsers.map(user => user._id)
        const servicerId = servicerUsers.map(user => user._id)
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } })
        // let getPrimary = await supportingFunction.getPrimaryUser({ metaId: req.params.servicerId, isPrimary: true })
        if (adminUsers.length > 0) {
          let notificationData = {
            title: "Servicer Status Updated",
            description: `The Servicer ${checkServicer.name} status has been updated to ${data.status ? "Active" : "Inactive"} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
            userId: req.teammateId,
            flag: 'servicer',
            notificationFor: IDs,
            endPoint: base_url + "servicerDetails/" + checkServicer._id,
            redirectionId: "servicerDetails/" + checkServicer._id
          };
          notificationArray.push(notificationData)
        }
        if (servicerUsers.length > 0) {
          let notificationData = {
            title: "Status Updated",
            description: `GetCover has updated your status to ${data.status ? "Active" : "Inactive"}.`,
            userId: req.teammateId,
            flag: 'servicer',
            notificationFor: servicerId,
            endPoint: "",
            redirectionId: ""
          };
          notificationArray.push(notificationData)
        }


        let createNotification = await userService.saveNotificationBulk(notificationArray);

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
        let mergedEmail;
        let notificationEmails = adminUsers.map(user => user.email);
        const servicerEmail = servicerUsers.map(user => user.email)
        mergedEmail = notificationEmails.concat(servicerEmail)
        let settingData = await userService.getSetting({});
        let resetLink = `${process.env.SITE_URL}newPassword/${getPrimary._id}/${resetPasswordCode}`

        const status_content = req.body.status || req.body.status == "true" ? 'Active' : 'Inactive';
        const content = req.body.status ? 'Congratulations, you can now login to our system. Please click the following link to login to the system' : "Your account has been made inactive. If you think, this is a mistake, please contact our support team at support@getcover.com"

        let emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: checkServicer.name,
          content: content,
          redirectId: status_content == "Active" ? resetLink : '',
          subject: "Update Status"
        }
        let mailing
        if (getPrimary) {
          mailing = await sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, 'noreply@getcover.com', emailData))
          maillogservice.createMailLogFunction(mailing, emailData, [getPrimary], process.env.update_status)

        }
        emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: checkServicer.name,
          content: `Servicer Status has been changed to ${status_content}`,
          redirectId: '',
          subject: "Update Status"
        }

        emailData.senderName = "Dear Admin"
        if (notificationEmails.length > 0) {
          mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, 'noreply@getcover.com', emailData))
          maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
        }
        emailData.senderName = "Dear " + checkServicer.name
        if (servicerEmail.length > 0) {
          mailing = await sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, 'noreply@getcover.com', emailData))
          maillogservice.createMailLogFunction(mailing, emailData, servicerUsers, process.env.update_status)
        }
        res.send({
          code: constant.successCode,
          message: "Updated Successfully 'false'",
          result: { updateData, updateMetaData }
        })
      }
    } else {
      if (checkServicer.isAccountCreate) {
        let criteria1 = { metaData: { $elemMatch: { metaId: checkServicer._id, isPrimary: true } } }
        let updateMetaData = await userService.updateUser(criteria1, {
          $set: {
            'metaData.$.status': data.status,
          }
        }, { new: true })


        if (!updateMetaData) {
          res.send({
            code: constant.errorCode,
            message: "Unable to update the primary details"
          })
        }
        else {
          //Send notification to servicer and admin
          //send notification to dealer,reseller,admin,customer
          const IDs = adminUsers.map(user => user._id)
          const servicerId = servicerUsers.map(user => user._id)
          let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } })
          // let getPrimary = await supportingFunction.getPrimaryUser({ metaId: req.params.servicerId, isPrimary: true })
          if (adminUsers.length > 0) {
            let notificationData = {
              title: "Servicer Status Updated",
              description: `The Servicer ${checkServicer.name} status has been updated to ${data.status ? "Active" : "Inactive"} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
              userId: req.teammateId,
              flag: 'servicer',
              notificationFor: IDs,
              endPoint: base_url + "servicerDetails/" + checkServicer._id,
              redirectionId: "/servicerDetails/" + checkServicer._id
            };
            notificationArray.push(notificationData)
          }
          if (servicerUsers.length > 0) {
            let notificationData = {
              title: "Status Updated",
              description: `GetCover has updated your status to ${data.status ? "Active" : "Inactive"}.`,
              userId: req.teammateId,
              flag: 'servicer',
              notificationFor: servicerId,
              endPoint: "",
              redirectionId: ""
            };
            notificationArray.push(notificationData)
          }
          let createNotification = await userService.saveNotificationBulk(notificationArray);
          let mergedEmail;
          let notificationEmails = adminUsers.map(user => user.email);

          const servicerEmail = servicerUsers.map(user => user.email)
          mergedEmail = notificationEmails.concat(servicerEmail)
          let settingData = await userService.getSetting({});

          const status_content = req.body.status || req.body.status == "true" ? 'Active' : 'Inactive';
          const content = req.body.status ? 'Congratulations, you can now login to our system. Please click the following link to login to the system' : "Your account has been made inactive. If you think, this is a mistake, please contact our support team at support@getcover.com"
          let resetLink = `${process.env.SITE_URL}newPassword/${getPrimary._id}/${resetPasswordCode}`
          let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: checkServicer?.name,
            content: content,
            redirectId: status_content == "Active" ? resetLink : '',
            subject: "Update Status"
          }
          if (getPrimary) {
            mailing = await sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, 'noreply@getcover.com', emailData))
            maillogservice.createMailLogFunction(mailing, emailData, [getPrimary], process.env.update_status)
          }
          emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: checkServicer.name,
            content: `Servicer Status has been changed to ${status_content}`,
            redirectId: '',
            subject: "Update Status"
          }


          emailData.senderName = "Dear Admin"
          if (notificationEmails.length > 0) {
            mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, 'noreply@getcover.com', emailData))
            maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
          }

          emailData.senderName = "Dear " + checkServicer.name
          if (servicerEmail.length > 0) {
            mailing = await sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, 'noreply@getcover.com', emailData))
            maillogservice.createMailLogFunction(mailing, emailData, servicerUsers, process.env.update_status)
          }

          res.send({
            code: constant.successCode,
            message: "Updated Successfully 'false'",
            result: { updateData, updateMetaData }
          })
        }
      }
    }

    // Send Email code here


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
      result: { updateData, updateMetaData }
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

//Get all servicer 
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
    if (!serviceProviders) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    }

    const servicerIds = serviceProviders.map(obj => obj._id);
    // Get Dealer Primary Users from colection
    const query1 = { metaId: { $in: servicerIds }, isPrimary: true };
    let servicerUser = await userService.getMembers(query1, projection)

    if (!servicerUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    const result_Array = servicerUser.map(item1 => {
      const matchingItem = serviceProviders.find(item2 => item2._id.toString() === item1.metaId.toString());

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
    res.send({
      code: constant.errorCode,
      message: "Internal server error"
    });
  }
};

//Register Servicer
/**---------------------------------------------Register Service Provider---------------------------------------- */
exports.registerServiceProvider = async (req, res) => {
  try {
    const data = req.body;
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
        message: "Account name already exist"
      })
      return;
    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });

    if (existingUser) {
      const existingServicer3 = await providerService.getServicerByName({ _id: existingUser.metaId }, { isDeleted: 0, __v: 0 });
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
      metaData: [
        {
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          roleId: "65719c8368a8a86ef8e1ae4d",
          metaId: createMetaData._id,
        }
      ]

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
    const adminQuery = {
      metaData: {
        $elemMatch: {
          roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
          status: true,
          "registerNotifications.servicerRegistrationRequest": true,
        }
      },

    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })

    const IDs = adminUsers.map(user => user._id)

    const base_url = `${process.env.SITE_URL}servicerRequestList/${req.body.name}`

    const notificationData = {
      title: "New Servicer Request",
      description: `A New Servicer ${data.name} has registered with us on the portal.`,
      userId: req.teammateId,
      flag: 'servicer',
      redirectionId: "servicerRequestList/" + req.body.name,
      endPoint: base_url,
      notificationFor: IDs
    };

    // Create the user
    const createNotification = await userService.createNotification(notificationData);

    let settingData = await userService.getSetting({});

    let emailData = {
      dealerName: ServicerMeta.name,
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      c1: "Thank you for",
      c2: "Registering as a",
      c3: "Your account is currently pending approval from our admin.",
      c4: "Once approved, you will receive a confirmation emai",
      c5: "We appreciate your patience.",
      role: "Servicer!",
      subject: "New Servicer Registration Request Received",
    }
    let mailing
    // Send Email code here
    if (createdUser) {
      console.log("----------------------------",createdUser)
      mailing = await sgMail.send(emailConstant.dealerWelcomeMessage(data.email, emailData))
      console.log("mailing-----------------------",mailing,process.env.main_template)
      maillogservice.createMailLogFunction(mailing, emailData, [createdUser], process.env.main_template)
    }
    const admin = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true } } })

    const notificationEmail = adminUsers.map(user => user.email)
    emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: "Dear Admin",
      content: "A new servicer " + ServicerMeta.name + " has been registered",
      subject: 'New Servicer Registration'
    }
    if (notificationEmail.length > 0) {
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmail, ["noreply@getcover.com"], emailData))
      maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }

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
      let criteria1 = { metaData: { $elemMatch: { metaId: updatedResult._id } } }
      let option = { new: true }
      let updateUsers = await userService.updateUser(criteria1, {
        $set: {
          'metaData.$.status': req.body.status,
        }
      }, option)
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
      let criteria1 = { metaData: { $elemMatch: { metaId: updatedResult._id, isPrimary: true } } }
      let option = { new: true }
      let updateUsers = await userService.updateUser(criteria1, {
        $set: {
          'metaData.$.status': req.body.status,
        }
      }, option)
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
    //let getUsers = await userService.findUser({ metaId: req.params.servicerId }, { isPrimary: -1 })
    const filteredData = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            {
              $or: [
                { metaData: { $elemMatch: { metaId: new mongoose.Types.ObjectId(req.params.servicerId) } } },
              ]
            },

          ]
        }
      },
      {
        $project: {
          email: 1,
          'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
          'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
          'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
          'position': { $arrayElemAt: ["$metaData.position", 0] },
          'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
          'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
          'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
          'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
          'status': { $arrayElemAt: ["$metaData.status", 0] },
          resetPasswordCode: 1,
          isResetPassword: 1,
          approvedStatus: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);
    if (!filteredData) {
      res.send({
        code: constant.errorCode,
        message: "No Users Found!"
      })
    } else {
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
    let checkUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: req.params.servicerId, isPrimary: true } } }, { isDeleted: false })
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "user already exist with this email"
      })
    } else {
      let statusCheck;
      if (!checkServicer.accountStatus) {
        statusCheck = false
      } else {
        statusCheck = data.status
      }

      let metaData = {
        email: data.email,
        metaData: [
          {
            metaId: checkServicer._id,
            status: statusCheck,
            roleId: "65719c8368a8a86ef8e1ae4d",
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
            position: data.position,
            isPrimary: false,
            dialCode: data.dialCode ? data.dialCode : "+1"

          }
        ]

      }
      let saveData = await userService.createUser(metaData)

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

      // Send notification when create
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let notificationArray = []
      const adminServicerUserQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "servicerNotification.userAdded": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
                ]
              }
            ]
          }
        },
      }
      const servicerServicerUserQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "servicerNotification.userAdded": true },
              { status: true },
              {
                $or: [
                  { metaId: new mongoose.Types.ObjectId(req.params.servicerId) },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminServicerUserQuery, { email: 1, metaData: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerServicerUserQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      const servicerId = servicerUsers.map(user => user._id)
      if (adminUsers.length > 0) {
        let notificationData = {
          title: "Servicer User Added",
          description: `A new user for Servicer ${checkServicer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
          userId: req.userId,
          contentId: checkServicer._id,
          flag: 'Servicer User',
          tabAction: "servicerUser",
          endPoint: base_url + "servicerDetails/" + checkServicer._id,
          redirectionId: "servicerDetails/" + checkServicer._id,
          notificationFor: IDs
        };
        notificationArray.push(notificationData)
      }
      if (servicerUsers.length > 0) {
        let notificationData = {
          title: "New User Added",
          description: `A new user for you account has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
          userId: req.userId,
          contentId: checkServicer._id,
          flag: 'Servicer User',
          endPoint: base_url + "servicer/user",
          redirectionId: "servicer/user",
          notificationFor: servicerId
        };
        notificationArray.push(notificationData)
      }

      let createNotification = await userService.saveNotificationBulk(notificationArray);

      let email = data.email
      let userId = saveData._id
      let resetPasswordCode = randtoken.generate(4, '123456789')
      let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
      let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
      let settingData = await userService.getSetting({});

      const mailing = await sgMail.send(emailConstant.servicerApproval(email,
        {
          flag: "Approved",
          link: resetLink,
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          title: settingData[0]?.title,
          subject: "Set Password",
          role: "Servicer User",
          address: settingData[0]?.address,
          servicerName: data.firstName + " " + data.lastName
        }))
      let emailData = {
        flag: "Approved",
        link: resetLink,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        title: settingData[0]?.title,
        subject: "Set Password",
        role: "Servicer User",
        address: settingData[0]?.address,
        servicerName: data.firstName + " " + data.lastName
      }
      maillogservice.createMailLogFunction(mailing, emailData, [saveData], process.env.servicer_approval)

      const notificationEmails = adminUsers.map(user => user.email)

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

//Create Relation with Dealer
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
      const adminAssignServicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },

            ]
          }
        },
      }
      const servicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkServicer._id) },
            ]
          }
        },
      }
      const dealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              {
                $or: [
                  { metaId: { $in: newDealerIds } },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminAssignServicerQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1, metaData: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerQuery, { email: 1, metaData: 1 })

      const IDs = adminUsers.map(user => user._id)
      const dealerId = dealerUsers.map(user => user._id)
      const servicerId = servicerUsers.map(user => user._id)
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let notificationArray = {
        title: "Dealer Assigned to Servicer",
        description: `We are reaching out to notify you about a recent update regarding the dealer list assigned to ${checkServicer.name}`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "servicer",
        notificationFor: IDs,
        redirectionId: "/dealerDetails/" + req.params.dealerId,
        endPoint: base_url + "dealerDetails/" + req.params.dealerId
      };


      let createNotification = await userService.createNotification(notificationArray);

      notificationArray = {
        title: "Dealer Assigned",
        description: `We are reaching out to notify you about a recent update regarding the servicer list assigned to you`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: dealerId,
        redirectionId: "/dealer/servicerList",
        endPoint: base_url + "dealer/servicerList"
      };


      createNotification = await userService.createNotification(notificationArray);

      notificationArray = {
        title: "Dealer Assigned",
        description: `We are reaching out to notify you about a recent update regarding the dealer list assigned to you`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: servicerId,
        redirectionId: "/servicer/dealerList",
        endPoint: base_url + "servicer/dealerList"
      }


      createNotification = await userService.createNotification(notificationArray);
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
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Dealer servicer
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
    let idsq = getDealersIds.map((item) => new mongoose.Types.ObjectId(item.dealerId))
    let dealers = await dealerService.getAllDealers({ _id: { $in: ids } }, {})

    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    // return false;

    const dealarUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: { $in: ids }, isPrimary: true } } }
          ]
        }
      },
      {
        $project: {
          email: 1,
          'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
          'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
          'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
          'position': { $arrayElemAt: ["$metaData.position", 0] },
          'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
          'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
          'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
          'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
          'status': { $arrayElemAt: ["$metaData.status", 0] },
          resetPasswordCode: 1,
          isResetPassword: 1,
          approvedStatus: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    let orderQuery = { dealerId: { $in: ids }, status: "Active" };
    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      servicerId: 1,
      customerId: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      venderOrder: 1,
      orderAmount: 1,
    }
    let orderData = await orderService.getAllOrderInCustomers(orderQuery, project, "$dealerId");

    //Get Claim Result 
    const claimQuery = { _id: { $in: idsq } }

    const dealerAggregationQuery = [
      {
        $match: claimQuery
      },
      {
        $unwind: "$items"
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "dealerId",
          as: "orders",
        }
      },
      {
        $unwind: "$orders"
      },
      {
        "$lookup": {
          "from": "claims",
          "localField": "orders.unique_key",
          "foreignField": "orderId",
          "pipeline": [{
            $group: {
              _id: "$itemNumber",
              count: {
                $sum: "$totalAmount"
              }
            }
          }],
          "as": "result"
        }
      }
    ]

    const dealerClaims = await dealerService.getDealerAndClaims(dealerAggregationQuery);

    const result_Array = dealarUser.map(item1 => {
      const matchingItem = dealers.find(item2 => item2._id.toString() === item1.metaId.toString());
      const orders = orderData.find(order => order._id.toString() === item1.metaId.toString())

      if (matchingItem || orders) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          dealerData: matchingItem.toObject(),
          ordersData: orders ? orders : {}
        };
      } else {
        return dealerData.toObject();
      }
    });

    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.dealerData.name)
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

//Get servicer of Dealer new api
exports.getServicerDealers1 = async (req, res) => {
  try {
    let data = req.body

    let query = [
      {
        $match: {
          servicerId: new mongoose.Types.ObjectId(req.params.servicerId)
        }
      },
      {
        $lookup: {
          from: "dealers",
          localField: "dealerId",
          foreignField: "_id",
          as: "dealerData",
          pipeline: [
            {
              $match: {
                "name": { '$regex': data.name ? data.name : '', '$options': 'i' },
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "metaData.metaId",
                as: "userData",
                pipeline: [
                  {
                    $match: {
                      metaData: { $elemMatch: { isPrimary: true } },
                      "email": { '$regex': data.email ? data.email : '', '$options': 'i' },
                    }
                  },
                  {
                    $project: {
                      email: 1,
                      'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                    }
                  }
                ]
              }
            },
            { $unwind: "$userData" },
            {
              $lookup: {
                from: "claims",
                // let: { dealerId: "$_id" },
                localField: "_id",
                foreignField: "dealerId",
                as: "claimsData",
                pipeline: [
                  {
                    $match: {
                      servicerId: new mongoose.Types.ObjectId(req.params.servicerId),
                      claimFile: "completed"

                    }
                  },
                  {
                    $group: {
                      _id: { servicerId: new mongoose.Types.ObjectId(req.params.servicerId) },
                      totalAmount: { $sum: "$totalAmount" },
                      numberOfClaims: { $sum: 1 }
                    }
                  },
                  {
                    $project: {
                      _id: 0,
                      totalAmount: 1,
                      numberOfClaims: 1
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        $unwind: "$dealerData"
      },
      {
        $match: {
          // metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } }
          "dealerData.userData.phoneNumber": { '$regex': data.phoneNumber ? data.phoneNumber.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }

        }
      }

    ]

    let filteredData = await dealerRelationService.getDealerRelationsAggregate(query)

    console.log("filteredData----------------------", filteredData);
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

// get dealer list by servicer id
exports.getDealerList = async (req, res) => {
  try {
    let data = req.body
    let query = { isDeleted: false, status: "Approved", accountStatus: true }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(query, projection);
    let getRelations = await dealerRelationService.getDealerRelations({ servicerId: req.params.servicerId })
    if (!getRelations) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Id"
      })
      return;
    }

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

//Get servicer claim
exports.getServicerClaims = async (req, res) => {
  try {
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
              "claimType": 1,
              reason: 1,
              "unique_key": 1,
              totalAmount: 1,
              getCoverClaimAmount: 1,
              customerClaimAmount: 1,
              getcoverOverAmount: 1,
              customerOverAmount: 1,
              servicerId: 1,
              dealerName:"$contracts.orders.dealers.name",
              servicerName:"$servicerInfo.name",
              servicerName:"$servicerInfo.name",
              customerName:"$contracts.orders.customer.username",
              dealerSku: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.coverageType": 1,
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


    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

    let claimPaidStatus = {}
    if (data.claimPaidStatus != '' && data.claimPaidStatus != undefined) {
      claimPaidStatus = { "claimPaymentStatus": data.claimPaidStatus }
    }
    else {
      claimPaidStatus = {
        $or: [
          { "claimPaymentStatus": "Paid" },
          { "claimPaymentStatus": "Unpaid" },
        ]
      }
    }
    let dealerMatch = {}
    let dateMatch = {}
    let statusMatch = {}
    let resellerMatch = {}
    data.resellerMatch = data.resellerMatch ? data.resellerMatch : ""
    data.dealerName = data.dealerName ? data.dealerName : ""

    if (data.dealerName != "") {
      let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
      let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
      dealerMatch = { dealerId: { $in: dealerIds } }

    }

    if (data.resellerName != "") {
      let getReseller = await resellerService.getResellers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
      let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
      resellerMatch = { resellerId: { $in: resellerIds } }
    }

    statusMatch = {}

    if (data.dateFilter != "") {
      data.endDate = new Date(data.endDate).setHours(23, 59, 999, 0)
      if (data.dateFilter == "damageDate") {
        dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "openDate") {
        dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "closeDate") {
        dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
        statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
    }

    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            claimPaidStatus,
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'servicerId': new mongoose.Types.ObjectId(req.params.servicerId) },
            dealerMatch,
            resellerMatch,
            dateMatch,
            statusMatch,
          ]
        },
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "servicerId",
          foreignField: "_id",
          as: "servicerInfo",
        }
      },
      { $unwind: { path: "$servicerInfo", preserveNullAndEmptyArrays: true } },
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
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
          ]
        },
      },

    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }

    let allClaims = await claimService.getClaimWithAggregate(lookupQuery);
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
    let servicer;
    let servicerName = '';
    allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    let result_Array = resultFiter.map((item1) => {
      servicer = []
      let mergedData = []
      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        mergedData = dynamicOption.value.filter(contract =>
          item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
        );
      }
      item1.approveDate = ''
      if (item1?.approveDate != '') {
        item1.approveDate = item1.approveDate
      }
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
          allServicer: servicer,
          mergedData: mergedData

        }
      }
    })

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
    let getTheThresholdLimit = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

    result_Array = result_Array.map(claimObject => {
      const { productValue, claimAmount } = claimObject.contracts;

      // Calculate the threshold limit value
      const thresholdLimitValue = (getTheThresholdLimit.threshHoldLimit.value / 100) * productValue;

      // Check if claimAmount exceeds the threshold limit value
      let overThreshold = claimAmount > thresholdLimitValue;
      let threshHoldMessage = "Claim amount exceeds the allowed limit. This might lead to claim rejection. To proceed further with claim please contact admin."
      if (!overThreshold) {
        threshHoldMessage = ""
      }
      if (!getTheThresholdLimit.isThreshHoldLimit) {
        overThreshold = false
        threshHoldMessage = ""
      }

      // Return the updated object with the new key 'overThreshold'
      return {
        ...claimObject,
        overThreshold,
        threshHoldMessage
      };
    });
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
    const updateBulk = await claimService.markAsPaid(queryIds, { claimPaymentStatus: 'Paid', approveDate: new Date() }, { new: true })
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

//Get Paid UNpaid claims
exports.paidUnpaidClaim = async (req, res) => {
  try {
    let data = req.body
    let dateQuery = {}
    const paidFlag = req.body.paidFlag == 1 ? 'Paid' : 'Unpaid'

    if (data.noOfDays != '') {
      let end = moment().endOf('day').set({ millisecond: 0 })
      const start = moment().subtract(data.noOfDays, 'days').startOf('day')
      dateQuery = {
        claimDate: { $lte: new Date(start) }
        // claimDate: {
        //   $gt: new Date(start),
        //   $lte: new Date(end),
        // }
      }
    }

    let approveQuery = {}
    if (data.startDate != "" && data.endDate != "" && paidFlag == "Paid") {
      let start = new Date(data.startDate); // Replace with your start date
      let end = new Date(data.endDate);
      end.setHours(23, 59, 999, 0)
      // Add one day to the end date
      end.setDate(end.getDate() + 1);
      start.setDate(start.getDate() + 1);
      approveQuery = {
        approveDate: {
          $gte: new Date(start),
          $lte: new Date(end),
        }
      }

    }

    // let approveQuery = {}
    // if (data.startDate != "" && data.endDate != "" && paidFlag == "Paid") {
    //   let start = new Date(data.startDate); // Replace with your start date
    //   data.endDate = new Date(data.endDate)
    //   data.endDate.setHours(23, 59, 999, 0)
    //   // Add one day to the end date
    //   // end.setDate(end.getDate() + 1);
    //   start.setDate(start.getDate() + 1);
    //   approveQuery = {
    //     approveDate: {
    //       $gte: new Date(start),
    //       $lte: new Date(data.endDate),
    //     }
    //   }

    // }

    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let servicerId = req.params.servicerId
    let checkServicer = await providerService.getServiceProviderById({
      $or: [
        { _id: req.params.servicerId },
        { resellerId: req.params.servicerId },
        { dealerId: req.params.servicerId },

      ]
    })
    let servicerIdToCheck = checkServicer._id
    let match = {};

    // id is getting in the param from the frontend side

    // if (req.role == 'Dealer') {
    //   match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    //   checkServicer = await providerService.getServiceProviderById({ dealerId: req.userId })
    //   servicerIdToCheck = checkServicer._id
    //   servicerId = req.userId

    // }
    if (req.role == 'Reseller') {
      match = { 'contracts.orders.resellerId': new mongoose.Types.ObjectId(req.userId) }
      checkServicer = await providerService.getServiceProviderById({ resellerId: req.userId })
      servicerIdToCheck = checkServicer._id
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
              "claimType": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              ClaimType: 1,
              note: 1,
              approveDate: 1,
              totalAmount: 1,
              servicerId: 1,
              getcoverOverAmount: 1,
              dealerName:"$contracts.orders.dealers.name",
              servicerName:"$servicerInfo.name",
              servicerName:"$servicerInfo.name",
              customerName:"$contracts.orders.customer.username",
              customerOverAmount: 1,
              approveDate: 1,
              customerClaimAmount: 1,
              getCoverClaimAmount: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              dealerSku: 1,
              claimDate: 1,
              claimType: 1,
              approveDate: 1,
              claimStatus: 1,
              claimPaymentStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.pName": 1,
              "contracts.coverageType": 1,
              "contracts.model": 1,
              "contracts.coverageType": 1,
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
              "contracts.orders.dealers.accountStatus": 1,
              "contracts.orders.customer.username": 1,
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
                    "isServicer": "$$reseller.isServicer",
                    "status": "$$reseller.status"
                  }
                }
              }
            }
          },
        ]
      }
    })
    data.dealerName = data.dealerName ? data.dealerName : ""
    data.servicerName = data.servicerName ? data.servicerName : ""
    let servicerMatch = {}

    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer.length > 0) {
        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
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

    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },

            {
              $or: [
                { 'claimStatus.status': 'Completed' },
                { 'claimStatus.status': 'completed' },

              ]
            },

            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { claimPaymentStatus: paidFlag },
            dateQuery,
            approveQuery,
            { 'servicerId': { $in: [new mongoose.Types.ObjectId(servicerId), new mongoose.Types.ObjectId(servicerIdToCheck)] } }
          ]
        },
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "servicerId",
          foreignField: "_id",
          as: "servicerInfo",
        }
      },
      { $unwind: { path: "$servicerInfo", preserveNullAndEmptyArrays: true } },
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
          ]
        },
      },
    ]

    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }

    let allClaims = await claimService.getClaimWithAggregate(lookupQuery);
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
    let servicer;
    let servicerName = '';

    let allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

    let result_Array = await Promise.all(resultFiter.map(async (item1) => {
      servicer = []
      let servicerName = '';
      item1.approveDate = item1?.approveDate ? item1.approveDate : ''
      let selfServicer = false;
      let mergedData = []
      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        mergedData = dynamicOption.value.filter(contract =>
          item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
        );
      }
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }


      let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
      let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
      if (dealerResellerServicer.length > 0) {
        let dealerResellerServicer = await providerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
        servicer = servicer.concat(dealerResellerServicer);
      }

      if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
        let checkDealerServicer = await providerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })
        servicer.push(checkDealerServicer)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id?.toString() === item1.servicerId?.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer,
          mergedData: mergedData
        }
      }
    }));
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

// Setting Function
exports.saveServicerSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    const adminSetting = await userService.getSetting({ userId: req.userId });

    let servicerId = req.body.servicerId;
    let data = req.body;
    data.setDefault = 0;
    data.userId = servicerId
    data.whiteLabelLogo = adminSetting[0]?.whiteLabelLogo
    // data.logoLight = data.logoLight ? data.logoLight : adminSetting[0]?.logoLight
    // data.logoDark = data.logoDark ? data.logoDark : adminSetting[0]?.logoDark
    // data.favIcon = data.favIcon ? data.favIcon : adminSetting[0]?.favIcon

    let response;
    const getData = await userService.getSetting({ userId: servicerId });
    if (getData.length > 0) {
      response = await userService.updateSetting({ _id: getData[0]?._id }, data, { new: true })

    }
    else {
      data.title = adminSetting[0]?.title
      data.paymentDetail = adminSetting[0]?.paymentDetail
      data.address = adminSetting[0]?.address
      response = await userService.saveSetting(data)
    }
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: response
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Reset Setting
exports.resetServicerSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    // Define the default resetColor array

    let data = req.body;
    const adminSetting = await userService.getSetting({ userId: req.userId });
    let servicerId = data.id
    let response;
    const getData = await userService.getSetting({ userId: servicerId });
    response = await userService.updateSetting({ _id: getData[0]?._id }, {
      colorScheme: [],
      defaultColor: [],
      logoLight: {
        fileName: adminSetting[0].logoLight.fileName,
        name: adminSetting[0].logoLight.name,
        size: adminSetting[0].logoLight.size
      },
      logoDark: {
        fileName: adminSetting[0].logoDark.fileName,
        name: adminSetting[0].logoDark.name,
        size: adminSetting[0].logoDark.size
      },
      favIcon: {
        fileName: adminSetting[0].favIcon.fileName,
        name: adminSetting[0].favIcon.name,
        size: adminSetting[0].favIcon.size
      },
      title: adminSetting[0]?.title,
      address: adminSetting[0]?.address,
      paymentDetail: adminSetting[0]?.paymentDetail,
      setDefault: 1
    }, { new: true })

    res.send({
      code: constant.successCode,
      message: "Reset Successfully!!",
      result: response
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Set As default setting
exports.defaultSettingServicer = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    // Define the default resetColor array
    let response;
    let servicerId = req.params.servicerId

    let getData;
    let dealerSetting = await userService.getSetting({ userId: servicerId });
    if (getData.length > 0) {
      getData = dealerSetting
    }
    else {
      getData = await userService.getSetting({ userId: req.userId });

    }

    response = await userService.updateSetting({ _id: getData[0]?._id },
      {
        defaultColor: getData[0].colorScheme,
        setDefault: 1,
        defaultAddress: getData[0].address,
        defaultLightLogo: getData[0].logoLight,
        defaultTitle: getData[0].title,
        defaultDarkLogo: getData[0].logoDark,
        defaultPaymentDetail: getData[0].paymentDetail,
        defaultFavIcon: getData[0].favIcon,
      },
      { new: true })

    res.send({
      code: constant.successCode,
      message: "Set as default successfully!",
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Setting Data
exports.getServicerColorSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    let servicerId = req.params.servicerId

    let setting = await userService.getSetting({ userId: servicerId });
    const baseUrl = process.env.API_ENDPOINT;
    if (!setting[0] || setting[0].colorScheme.length == 0) {
      setting = await userService.getSetting({});
    }

    if (setting.length > 0) {
      setting[0].base_url = baseUrl;

      // Assuming setting[0].logoDark and setting[0].logoLight contain relative paths
      if (setting[0].logoDark && setting[0].logoDark.fileName) {
        setting[0].logoDark.baseUrl = baseUrl;
      }

      if (setting[0].logoLight && setting[0].logoLight.fileName) {
        setting[0].logoLight.baseUrl = baseUrl;
      }

      if (setting[0].favIcon && setting[0].favIcon.fileName) {
        setting[0].favIcon.baseUrl = baseUrl;
      }
      // Repeat for any other properties that need the base_url prepended
    }
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: setting
    });
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}




exports.updateClaimsApproveDate = async (req, res) => {
  try {
    let data = req.body
    let claims = await claimService.getClaims()
    console.log("---------------------dddd------", claims.length)
    for (let i = 0; i < claims.length; i++) {
      console.log(i, "----------------ddddgggggg-----------", claims[i].updatedAt, claims[i].unique_key)
      let approveDate = claims[i].claimDate
      console.log(i, "---------------------dddd------", approveDate)



      if (!claims[i].approveDate || claims[i].approveDate == null) {
        let newValue = {
          $set: {
            approveDate: approveDate
          }
        }
        let updateData = await claimService.updateClaim({ _id: claims[i]._id }, newValue, { new: true })
        console.log(i, "---------------------------", updateData.approveDate)
      }

    }

  } catch (err) {
    res.send({
      message: err.message
    })
  }
}