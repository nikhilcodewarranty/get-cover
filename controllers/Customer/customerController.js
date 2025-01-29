require("dotenv").config();

const LOG = require('../../models/User/logs')
const customerService = require("../../services/Customer/customerService");
const customerModel = require("../../models/Customer/customer");
let dealerService = require('../../services/Dealer/dealerService')
let resellerService = require('../../services/Dealer/resellerService')
let contractService = require('../../services/Contract/contractService')
let claimService = require('../../services/Claim/claimService')
let userService = require('../../services/User/userService')
let servicerService = require('../../services/Provider/providerService')
let orderService = require('../../services/Order/orderService')
const constant = require("../../config/constant");
const emailConstant = require('../../config/emailConstant');
const supportingFunction = require('../../config/supportingFunction')
const { default: mongoose } = require("mongoose");
const randtoken = require('rand-token').generator()
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);

//create custoemr api
exports.createCustomer = async (req, res, next) => {
  try {
    let data = req.body;
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
    let getCount = await customerService.getCustomersCount({})
    data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    // check dealer ID
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
    const adminQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerAdded": true },
            { status: true },
            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
          ]
        }
      },
    }
    const dealerQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerAdded": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
          ]
        }
      },
    }
    let resellerQuery
    let resellerUsers = []
    if (data?.resellerName) {
      resellerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "customerNotifications.customerAdded": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(data?.resellerName) },


            ]
          }
        },
      }
      resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerQuery, { email: 1 })

    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    const dealerId = dealerUsers.map(user => user._id)
    const resellerId = resellerUsers.map(user => user._id)
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid `dealer`"
      })
      return;
    };

    // check reseller valid or not
    if (data.resellerName && data.resellerName != "") {
      var checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
      if (!checkReseller) {
        res.send({
          code: constant.errorCode,
          message: "Invalid Reseller."
        })
        return;
      }

    }

    // check customer acccount name 
    let checkAccountName = await customerService.getCustomerByName({
      username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName
    });

    let checkCustomerEmail = await userService.findOneUser({ email: data.email });
    if (checkCustomerEmail) {
      res.send({
        code: constant.errorCode,
        message: "Primary user email already exist"
      })
      return;
    }
    let settingData = await userService.getSetting({});

    let customerObject = {
      username: data.accountName,
      street: data.street,
      city: data.city,
      isAccountCreate: data?.isAccountCreate ? data.isAccountCreate : data.status,
      dealerId: checkDealer._id,
      resellerId: checkReseller ? checkReseller._id : null,
      resellerId1: checkReseller ? checkReseller._id : null,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      unique_key: data.unique_key,
      accountStatus: "Approved",
      dealerName: checkDealer.name,
    }

    let teamMembers = data.members
    const emailSet = new Set();
    let isDuplicate = false;
    let emailsToCheck = teamMembers.map(member => member.email);
    let queryEmails = { email: { $in: emailsToCheck } };
    let checkEmails = await customerService.getAllCustomers(queryEmails, {});

    if (checkEmails.length > 0) {
      res.send({
        code: constant.errorCode,
        message: "Some email ids already exist"
      })
    }
    const createdCustomer = await customerService.createCustomer(customerObject);
    if (!createdCustomer) {
      //Save Logs create Customer
      let logData = {
        userId: req.userId,
        endpoint: "/create-customer",
        body: data,
        response: {
          code: constant.errorCode,
          message: createdCustomer
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Unable to create the customer"
      })
      return;
    };

    teamMembers = teamMembers.map(member => ({
      ...member,
      metaData:
        [
          {
            firstName: member.firstName,
            lastName: member.lastName,
            phoneNumber: member.phoneNumber,
            metaId: createdCustomer._id,
            roleId: process.env.customer,
            position: member.position,
            dialCode: member?.dialCode,
            status: !data.status ? false : member.status,
            isPrimary: member.isPrimary
          }
        ],
      approvedStatus: "Approved",

    })
    );
    // create members account 

    let saveMembers = await userService.insertManyUser(teamMembers)

    // Primary User Welcoime email
    let notificationEmails = adminUsers.map(user => user.email)
    let mergedEmail;
    let dealerEmails = dealerUsers.map(user => user.email)
    let resellerEmails = resellerUsers.map(user => user.email)
    mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkReseller?._id, isPrimary: true } } })

    //SEND EMAIL
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: getPrimary.metaData[0]?.firstName,
      // redirectId: base_url + "customerDetails/" + createdCustomer._id,
      content: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName} - User Role - ${req.role} on our portal.`,
      subject: "New Customer  Added"
    }

    // Send Email code here
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
    mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ['noreply@getcover.com'], emailData))
    mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ['noreply@getcover.com'], emailData))

    if (saveMembers.length > 0) {
      if (data.status) {
        for (let i = 0; i < saveMembers.length; i++) {
          if (saveMembers[i].metaData[0].status) {
            let email = saveMembers[i].email
            let userId = saveMembers[i]._id
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
            let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
            const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, {
              flag: "created", title: settingData[0]?.title,
              darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
              lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
              link: resetLink, subject: "Set Password", role: "Customer",
              servicerName: saveMembers[i].metaData[0].firstName + " "+ saveMembers[i].metaData[0].lastName,
              address: settingData[0]?.address,
            }))

          }

        }
      }
    }

    let notificationArray = []
    //Send Notification to customer,admin,reseller,dealer 
    let notificationData = {
      title: "New Customer  Added",
      description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
      userId: req.teammateId,
      flag: 'customer',
      notificationFor: IDs,
      redirectionId: "customerDetails/" + createdCustomer._id,
      endPoint: base_url + "customerDetails/" + createdCustomer._id,
    };
    notificationArray.push(notificationData)
    notificationData = {
      title: "New Customer  Added",
      description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
      userId: req.teammateId,
      flag: 'customer',
      notificationFor: dealerId,
      redirectionId: "dealer/customerDetails/" + createdCustomer._id,
      endPoint: base_url + "dealer/customerDetails/" + createdCustomer._id,
    };
    notificationArray.push(notificationData)
    notificationData = {
      title: "New Customer  Added",
      description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
      userId: req.teammateId,
      flag: 'customer',
      notificationFor: resellerId,
      redirectionId: "reseller/customerDetails/" + createdCustomer._id,
      endPoint: base_url + "reseller/customerDetails/" + createdCustomer._id,
    };
    notificationArray.push(notificationData)
    let createNotification = await userService.saveNotificationBulk(notificationArray);
    //Save Logs create Customer
    let logData = {
      userId: req.userId,
      endpoint: "/create-customer",
      body: data,
      response: {
        code: constant.successCode,
        message: "Customer created successfully",
        result: data
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: "Customer created successfully",
      result: createdCustomer
    })
  } catch (err) {
    //Save Logs create Customer
    let logData = {
      userId: req.userId,
      endpoint: "/create-customer catch",
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
};

//get all customers
exports.getAllCustomers = async (req, res, next) => {
  try {
    let data = req.body
    let query = { isDeleted: false }
    let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    const customersId = customers.map(obj => obj._id);
    const customersOrderId = customers.map(obj => obj._id);
    const queryUser = { metaId: { $in: customersId }, isPrimary: true };

    //Get Resselers
    const resellerId = customers.map(obj => new mongoose.Types.ObjectId(obj.resellerId ? obj.resellerId : '61c8c7d38e67bb7c7f7eeeee'));
    const queryReseller = { _id: { $in: resellerId } }
    const resellerData = await resellerService.getResellers(queryReseller, { isDeleted: 0 })

    const getPrimaryUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            // { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            // { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: { $in: customersId }, isPrimary: true } } }
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

    //Get customer Orders
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

    let orderQuery = { customerId: { $in: customersOrderId }, status: "Active" };

    let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId")

    const result_Array = customers.map(customer => {
      const matchingItem = getPrimaryUser.find(user => user.metaId.toString() === customer._id.toString())
      const matchingReseller = customer.resellerId != null ? resellerData.find(reseller => reseller._id.toString() === customer.resellerId.toString()) : ''
      const order = ordersData.find(order => order._id.toString() === customer._id.toString())
      if (matchingItem || matchingReseller || order) {
        return {
          ...matchingItem ? matchingItem : {},
          customerData: customer ? customer : {},
          reseller: matchingReseller ? matchingReseller : {},
          order: order ? order : {}
        };
      }

    }).filter(item => item !== undefined);
    let emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    let nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    let phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
    let dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    let resellerRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
    let filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.customerData.username) &&
        emailRegex.test(entry.email) &&
        dealerRegex.test(entry.customerData.dealerName) &&
        resellerRegex.test(entry.reseller?.name) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });
    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData
    })
  } catch (err) {
    res.send({
      code: constant.successCode,
      message: err.message,
    })
  }
};

//get dealer customers
exports.getDealerCustomers = async (req, res) => {
  try {
    let data = req.body
    let query = { isDeleted: false, dealerId: req.params.dealerId }
    let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    const customersId = customers.map(obj => obj._id);
    const orderCustomerId = customers.map(obj => obj._id);
    const queryUser = { metaId: { $in: customersId }, isPrimary: true };

    //Get Dealer Customer Orders
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

    let orderQuery = {
      $and: [
        { customerId: { $in: orderCustomerId }, status: "Active" },
        {
          'venderOrder': { '$regex': req.body.venderOrderNumber ? req.body.venderOrderNumber : '', '$options': 'i' },
        },
      ]
    }
    let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$customerId');
    //Get Resseler
    const resellerId = customers.map(obj => new mongoose.Types.ObjectId(obj.resellerId ? obj.resellerId : '61c8c7d38e67bb7c7f7eeeee'));
    const queryReseller = { _id: { $in: resellerId } }
    const resellerData = await resellerService.getResellers(queryReseller, { isDeleted: 0 })

    let name = data.firstName ? data.firstName : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    const getPrimaryUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { lastName: { '$regex': newObj.l_name ? newObj.l_name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { firstName: { '$regex': newObj.f_name ? newObj.f_name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: { $in: customersId }, isPrimary: true } } }
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

    const result_Array = getPrimaryUser.map(item1 => {
      const matchingItem = customers.find(item2 => item2._id.toString() === item1.metaId.toString());
      const matchingReseller = matchingItem ? resellerData.find(reseller => reseller._id?.toString() === matchingItem.resellerId?.toString()) : {};
      const order = ordersResult.find(order => order._id.toString() === item1.metaId.toString())

      if (matchingItem || order || matchingReseller) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          customerData: matchingItem ? matchingItem.toObject() : {},
          orderData: order ? order : {},
          reseller: matchingReseller ? matchingReseller : {},
        };
      } else {
        return {};
      }
    });



    const resellerRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        resellerRegex.test(entry.reseller.name)
      );
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//get reseller customers
exports.getResellerCustomers = async (req, res) => {
  try {
    let data = req.body;
    let query = { isDeleted: false, resellerId: req.params.resellerId }
    let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
    console.log("query++++++++++++++++++++++++++", query)
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    console.log("query++++++++++++++++++++++++++", customers)

    const customersId = customers.map(obj => obj._id);
    const orderCustomerIds = customers.map(obj => obj._id);
    const queryUser = { metaId: { $in: customersId }, isPrimary: true };

    let getPrimaryUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: { $in: customersId }, isPrimary: true } } }
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

    let orderQuery = {
      $and: [
        { customerId: { $in: orderCustomerIds }, status: "Active" },
        {
          'venderOrder': { '$regex': req.body.venderOrderNumber ? req.body.venderOrderNumber.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
        },
      ]
    }
    let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$customerId');

    let result_Array = getPrimaryUser.map(item1 => {
      const matchingItem = customers.find(item2 => item2._id.toString() === item1.metaId.toString());
      const order = ordersResult.find(order => order._id.toString() === item1.metaId.toString())
      if (matchingItem || order) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          customerData: matchingItem ? matchingItem.toObject() : {},
          orderData: order ? order : {},
        };
      } else {
        return {};
      }
    });

    const nameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    result_Array = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.customerData.username) &&
        dealerRegex.test(entry.customerData.dealerId)
      );
    });

    res.send({
      code: constant.successCode,
      result: result_Array
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// edit customer api
exports.editCustomer = async (req, res) => {
  try {
    let data = req.body
    data.username = data.username.trim().replace(/\s+/g, ' ');
    let settingData = await userService.getSetting({});

    let checkDealer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid ID"
      })
      return;
    };
    let criteria1 = { _id: checkDealer._id }
    let option = { new: true }
    let updateCustomer = await customerService.updateCustomer(criteria1, data, option)
    if (!updateCustomer) {
      //Save Logs editCustomer
      let logData = {
        userId: req.userId,
        endpoint: "/editCustomer/:customerId",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the customer detail"
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Unable to update the customer detail"
      })
      return;
    }
    if (data.hasOwnProperty("isAccountCreate")) {
      if ((data.isAccountCreate || data.isAccountCreate == 'true')) {
        let updatePrimaryUser = await userService.updateSingleUser({ metaData: { $elemMatch: { metaId: req.params.customerId, isPrimary: true } } }, {
          $set: {
            'metaData.$.status': true,
          }
        }, { new: true })
      } else {
        let updatePrimaryUser = await userService.updateUser({ metaData: { $elemMatch: { metaId: req.params.customerId } } }, {
          $set: {
            'metaData.$.status': false,
          }
        }, { new: true })
      }
    }

    //send notification to dealer,customer,admin,reseller
    let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer.dealerId, isPrimary: true } } })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer.resellerId, isPrimary: true } } })
    //Merge start Singleserver

    const dealerCheck = await dealerService.getDealerById(checkDealer.dealerId)

    const checkReseller = await resellerService.getReseller({ _id: checkDealer.resellerId }, { isDeleted: false })
    //Notification to dealer,admin,reseller
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminDealerrQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerUpdate": true },
            { status: true },
            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
          ]
        }
      },
    }

    const dealerrQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(checkDealer.dealerId) }
          ]
        }
      },
    }

    const reellerQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(checkDealer?.resellerId) }
          ]
        }
      },
    }

    const customerQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "customerNotifications.customerUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(checkDealer._id) }
          ]
        }
      },
    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerrQuery, { email: 1 })
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerrQuery, { email: 1 })
    let resellerUsers = await supportingFunction.getNotificationEligibleUser(reellerQuery, { email: 1 })
    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerQuery, { email: 1 })
    let notificationArray = []
    let mergedEmail
    let notificationEmails = adminUsers.map(user => user.email)
    let IDs = adminUsers.map(user => user._id)
    let dealerIds = dealerUsers.map(user => user._id)
    let customerIds = customerUsers.map(user => user._id)
    let dealerEmails = dealerUsers.map(user => user.email)
    let customerEmails = customerUsers.map(user => user.email)
    let resellerId = resellerUsers.map(user => user._id)
    let resellerEmail = resellerUsers.map(user => user.email)
    mergedEmail = notificationEmails.concat(dealerEmails, resellerEmail, customerEmails)

    let notificationData = {
      title: "Customer Details Updated",
      description: `The details of customer ${checkDealer.username} for the Dealer ${dealerCheck.name} has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
      userId: req.teammateId,
      redirectionId: "customerDetails/" + checkDealer._id,
      flag: 'customer',
      endPoint: base_url + "customerDetails/" + checkDealer._id,
      notificationFor: IDs
    };
    notificationArray.push(notificationData)
    notificationData = {
      title: "Customer Details Updated",
      description: `The details of customer ${checkDealer.username}  has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
      userId: req.teammateId,
      redirectionId: "dealer/customerDetails/" + checkDealer._id,
      flag: 'customer',
      endPoint: base_url + "dealer/customerDetails/" + checkDealer._id,
      notificationFor: dealerIds
    };
    notificationArray.push(notificationData)
    if (resellerUsers.length > 0) {
      notificationData = {
        title: "Customer Details Updated",
        description: `The details of customer ${checkDealer.username} has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        redirectionId: "reseller/customerDetails/" + checkDealer._id,
        flag: 'customer',
        endPoint: base_url + "reseller/customerDetails/" + checkDealer._id,
        notificationFor: resellerId
      };
      notificationArray.push(notificationData)
    }

    notificationData = {
      title: "Details Updated",
      description: `The details for your account has been changed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      userId: req.teammateId,
      redirectionId: "customer/user",
      flag: 'customer',
      endPoint: base_url + "customer/user",
      notificationFor: customerIds
    };
    notificationArray.push(notificationData)

    let createNotification = await userService.saveNotificationBulk(notificationArray);

    // Send Email code here

    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: checkDealer.username,
      content: "The customer " + checkDealer.username + "" + " " + "has been updated successfully.",
      subject: "Customer Update"
    }


    let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ["noreply@getcover.com"], emailData))

    //Save Logs editCustomer
    let logData = {
      userId: req.userId,
      endpoint: "/editCustomer/:customerId",
      body: data,
      response: {
        code: constant.successCode,
        message: "Updated successfully"
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
    let logData = {
      userId: req.userId,
      endpoint: "/editCustomer/:customerId",
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

//change customer primary user api
exports.changePrimaryUser = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
    let settingData = await userService.getSetting({});
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find the user"
      })
      return;
    };
    // let updateLastPrimary = await userService.updateSingleUser({ metadata: checkUser.metaData[0]?.metaId, isPrimary: true }, { isPrimary: false }, { new: true })

    let updateLastPrimary = await userService.updateSingleUser(
      {
        'metaData.metaId': checkUser.metaData[0]?.metaId,
        'metaData.isPrimary': true
      },
      {
        $set: {
          'metaData.$.isPrimary': false,
        }
      },
      {
        new: true      // Return the updated document
      }
    );


    if (!updateLastPrimary) {
      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to change tha primary"
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Unable to change tha primary"
      })
      return;
    };


    let updatePrimary = await userService.updateSingleUser(
      { _id: checkUser._id, 'metaData.metaId': checkUser.metaData[0]?.metaId },
      {
        $set: {
          'metaData.$.isPrimary': true,
        }
      },
      {
        new: true      // Return the updated document
      }
    );


    const checkDealer = await dealerService.getDealerById(updatePrimary.metaData[0]?.metaId)

    const checkReseller = await resellerService.getReseller({ _id: updatePrimary.metaData[0]?.metaId }, { isDeleted: false })

    const checkCustomer = await customerService.getCustomerById({ _id: updatePrimary.metaData[0]?.metaId })

    const checkServicer = await servicerService.getServiceProviderById({ _id: updatePrimary.metaData[0]?.metaId })
    //Merge end

    //Get role by id
    const checkRole = await userService.getRoleById({ _id: checkUser.metaData[0]?.roleId }, {});

    if (!updatePrimary) {
      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Something went wrong",
          result: updatePrimary
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      })
    }
    else {
      //Send notification for dealer change primary user
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let adminUpdatePrimaryQuery
      let mergedEmail
      let notificationData
      let notificationArray = []
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: `${updateLastPrimary.metaData[0]?.firstName}`,
        content: "The primary user for your account has been changed from " + updateLastPrimary.metaData[0]?.firstName + " to " + updatePrimary.metaData[0]?.firstName + ".",
        subject: "Primary User change"
      };
      if (checkServicer) {
        adminUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "servicerNotification.primaryChanged": true },
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
        let servicerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "servicerNotification.primaryChanged": true },
                { status: true },
                {
                  $or: [
                    { roleId: new mongoose.Types.ObjectId("65719c8368a8a86ef8e1ae4d") },
                  ]
                }
              ]
            }
          },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdatePrimaryQuery, { email: 1 })
        let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerUpdatePrimaryQuery, { email: 1 })
        let notificationEmails = adminUsers.map(user => user.email);
        let servicerEmails = servicerUsers.map(user => user.email);
        const IDs = adminUsers.map(user => user._id)
        const servicerId = servicerUsers.map(user => user._id)
        notificationData = {
          title: "Servicer Primary User Updated",
          description: `The Primary user for ${checkServicer.name} has been changed from ${updateLastPrimary.metaData[0]?.firstName} to ${updatePrimary.metaData[0]?.firstName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          tabAction: "servicerUser",
          redirectionId: "servicerDetails/" + checkServicer._id,
          endPoint: base_url + "servicerDetails/" + checkServicer._id,
          notificationFor: IDs
        };
        notificationArray.push(notificationData)
        notificationData = {
          title: "Primary User Changed",
          description: `The Primary user for your account has been changed from ${updateLastPrimary.metaData[0]?.firstName} to ${updatePrimary.metaData[0]?.firstName}  by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          redirectionId: "servicer/user",
          endPoint: base_url + "servicer/user",
          notificationFor: servicerId
        };
        notificationArray.push(notificationData)
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmails, ["noreply@getcover.com"], emailData))
      }
      if (checkDealer) {
        adminUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "dealerNotifications.primaryChanged": true },
                { status: true },
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          },
        }
        let servicerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "dealerNotifications.primaryChanged": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
              ]
            }
          },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdatePrimaryQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(servicerUpdatePrimaryQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        let dealerEmails = dealerUsers.map(user => user.email);
        let notificationEmails = adminUsers.map(user => user.email);

        notificationData = {
          title: "Dealer Primary User Updated",
          description: `The Primary user for ${checkDealer.name} has been changed from ${updateLastPrimary.metaData[0]?.firstName} to ${updatePrimary.metaData[0]?.firstName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          tabAction: "dealerUser",
          redirectionId: "dealerDetails/" + checkDealer._id,
          endPoint: base_url + "dealerDetails/" + checkDealer._id,
          notificationFor: IDs
        };
        notificationArray.push(notificationData)
        notificationData = {
          title: "Primary User Updated",
          description: `The Primary user for your account has been changed from ${updateLastPrimary.metaData[0]?.firstName} to ${updatePrimary.metaData[0]?.firstName}  by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          redirectionId: "dealer/user",
          endPoint: base_url + "dealer/user",
          notificationFor: dealerId
        };
        notificationArray.push(notificationData)
        console.log("notificationEmails--------------------------", notificationEmails)
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))


      }
      if (checkReseller) {
        let resellerDealer = await dealerService.getDealerById(checkReseller.dealerId)

        adminUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "resellerNotifications.primaryChange": true },
                { status: true },
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          },
        }
        let dealerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "resellerNotifications.primaryChange": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkReseller.dealerId) },
              ]
            }
          },
        }
        let resellerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "resellerNotifications.primaryChange": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkReseller._id) },
              ]
            }
          },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdatePrimaryQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUpdatePrimaryQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerUpdatePrimaryQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        const resellerId = resellerUsers.map(user => user._id)
        let dealerEmails = dealerUsers.map(user => user.email);
        let resellerEmails = resellerUsers.map(user => user.email);
        let notificationEmails = adminUsers.map(user => user.email);

        mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)

        notificationData = {
          title: "Reseller Primary User Updated",
          description: `The Primary user of Reseller ${checkReseller.name} for ${resellerDealer.name} has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
          userId: req.teammateId,
          tabAction: "resellerUser",
          flag: checkRole?.role,
          redirectionId: "resellerDetails/" + checkReseller._id,
          endPoint: base_url + "resellerDetails/" + checkReseller._id,
          notificationFor: IDs
        };
        notificationArray.push(notificationData)
        notificationData = {
          title: "Reseller Primary User Updated",
          description: `The Primary user of Reseller  ${checkReseller.name} has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
          userId: req.teammateId,
          tabAction: "resellerUser",
          flag: checkRole?.role,
          redirectionId: "dealer/resellerDetails/" + checkReseller._id,
          endPoint: base_url + "dealer/resellerDetails/" + checkReseller._id,
          notificationFor: dealerId
        };
        notificationArray.push(notificationData)
        notificationData = {
          title: "Primary User Updated",
          description: `The Primary user for your account has been changed from  ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          redirectionId: "reseller/user",
          endPoint: base_url + "reseller/user",
          notificationFor: resellerId
        };
        notificationArray.push(notificationData)


        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))

      }
      if (checkCustomer) {
        let customerDealer = await dealerService.getDealerById(checkCustomer.dealerId)

        adminUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "customerNotifications.primaryChange": true },
                { status: true },
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          },
        }
        let dealerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "customerNotifications.primaryChange": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkCustomer.dealerId) },
              ]
            }
          },
        }
        let resellerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "customerNotifications.primaryChange": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkCustomer?.resellerId) },
              ]
            }
          },
        }
        let customerUpdatePrimaryQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "customerNotifications.primaryChange": true },
                { status: true },
                { metaId: new mongoose.Types.ObjectId(checkCustomer._id) },
              ]
            }
          },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdatePrimaryQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUpdatePrimaryQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerUpdatePrimaryQuery, { email: 1 })
        let customerUsers = await supportingFunction.getNotificationEligibleUser(customerUpdatePrimaryQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        const resellerId = resellerUsers.map(user => user._id)
        const customerId = customerUsers.map(user => user._id)
        let notificationEmails = adminUsers.map(user => user.email);
        console.log("adminUsers-----------------------", adminUsers)
        console.log("dealerUsers-----------------------", dealerUsers)
        console.log("resellerUsers-----------------------", resellerUsers)
        let dealerEmails = dealerUsers.map(user => user.email);
        let resellerEmails = resellerUsers.map(user => user.email);
        let customerEmails = customerUsers.map(user => user.email);

        mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails, customerEmails)

        notificationData = {
          title: "Customer Primary User Updated",
          description: `The Primary user of Customer ${checkCustomer.username} for ${customerDealer.name} has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}-${req.role}.`,
          userId: req.teammateId,
          tabAction: "customerUser",
          flag: checkRole?.role,
          redirectionId: "customerDetails/" + checkCustomer._id,
          endPoint: base_url + "customerDetails/" + checkCustomer._id,
          notificationFor: IDs
        };
        notificationArray.push(notificationData)
        notificationData = {
          title: "Customer Primary User Updated",
          description: `The Primary user of Customer ${checkCustomer.username} has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}-${req.role}.`,

          userId: req.teammateId,
          tabAction: "customerUser",
          flag: checkRole?.role,
          redirectionId: "dealer/customerDetails/" + checkCustomer._id,
          endPoint: base_url + "dealer/customerDetails/" + checkCustomer._id,
          notificationFor: dealerId
        };
        notificationArray.push(notificationData)

        if (resellerUsers.length > 0) {
          notificationData = {
            title: "Customer Primary User Updated",
            description: `The Primary user of Customer ${checkCustomer.username} has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}-${req.role}.`,
            userId: req.teammateId,
            flag: checkRole?.role,
            tabAction: "customerUser",
            redirectionId: "reseller/customerDetails/" + checkCustomer._id,
            endPoint: base_url + "reseller/customerDetails/" + checkCustomer._id,
            notificationFor: resellerId
          };
          notificationArray.push(notificationData)
        }

        notificationData = {
          title: "Primary User Updated",
          description: `The Primary user for your account has been changed from ${updateLastPrimary.metaData[0]?.firstName + " " + updateLastPrimary.metaData[0]?.lastName} to ${updatePrimary.metaData[0]?.firstName + " " + updatePrimary.metaData[0]?.lastName}  by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: checkRole?.role,
          redirectionId: "customer/user",
          endPoint: base_url + "customer/user",
          notificationFor: customerId
        };
        notificationArray.push(notificationData)
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
        mailing = sgMail.send(emailConstant.sendEmailTemplate(customerEmails, ["noreply@getcover.com"], emailData))
      }
      let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkUser.metaData[0]?.metaId }, isPrimary: true } })
      let createNotification = await userService.saveNotificationBulk(notificationArray);
      // Send Email code here


      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.successCode,
          message: "Updated successfully",
          result: updatePrimary
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.successCode,
        message: "Updated successfully",
        result: updatePrimary
      })
    }

  } catch (err) {
    //Save Logs changePrimaryUser
    let logData = {
      endpoint: "changePrimaryUser catch",
      userId: req.userId,
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

// add customer user api
exports.addCustomerUser = async (req, res) => {
  try {
    let data = req.body

    let checkCustomer = await customerService.getCustomerByName({ _id: data.customerId })
    let checkDealer = await dealerService.getDealerByName({ _id: checkCustomer.dealerId }, {})
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer"
      })
      return;
    }
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already added with this email"
      })
      return;
    };
    let checkUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: data.customerId, isPrimary: true } } }, { isDeleted: false })

    let metaData = {
      email: data.email,
      metaData: [
        {
          metaId: checkCustomer._id,
          status: checkUser.metaData[0]?.status ? true : false,
          roleId: process.env.customer,
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
        endpoint: "addCustomerUser",
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
    } else {
      //Send notification
      const adminDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "customerNotifications.userAdd": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
            ]
          }
        },
      }
      const dealerDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "customerNotifications.userAdd": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkCustomer.dealerId) },
            ]
          }
        },
      }
      const resellerDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "customerNotifications.userAdd": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkCustomer?.resellerId1) },
            ]
          }
        },
      }
      const customerDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "customerNotifications.userAdd": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkCustomer?._id) },
            ]
          }
        },
      }

      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerQuery, { email: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerDealerQuery, { email: 1 })
      let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerDealerQuery, { email: 1 })
      let customerUsers = await supportingFunction.getNotificationEligibleUser(customerDealerQuery, { email: 1 })
      const IDs = adminUsers.map(user => user._id)
      let notificationArray = []
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      const dealerId = dealerUsers.map(user => user._id)
      const resellerId = resellerUsers.map(user => user._id)
      const customerId = customerUsers.map(user => user._id)
      let notificationData = {
        title: "Customer User Added",
        description: `A new user for customer ${checkCustomer.username} under ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: saveData._id,
        flag: 'customerUser',
        endPoint: base_url + "customerDetails/" + checkCustomer._id,
        redirectionId: "customerDetails/" + checkCustomer._id,
        notificationFor: IDs
      };
      notificationArray.push(notificationData)
      notificationData = {
        title: "Customer User Added",
        description: `A new user for customer ${checkCustomer.username} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: saveData._id,
        flag: 'customer_user',
        tabAction: "customerUser",
        endPoint: base_url + "dealer/customerDetails/" + checkCustomer._id,
        redirectionId: "dealer/customerDetails/" + checkCustomer._id,
        notificationFor: dealerId
      };
      notificationArray.push(notificationData)
      if (resellerUsers.length > 0) {
        notificationData = {
          title: "Customer User Added",
          description: `A new user for customer ${checkCustomer.username} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
          userId: req.teammateId,
          contentId: saveData._id,
          flag: 'customer_user',
          tabAction: "customerUser",

          endPoint: base_url + "reseller/customerDetails/" + checkCustomer._id,
          redirectionId: "reseller/customerDetails/" + checkCustomer._id,
          notificationFor: resellerId
        };
        notificationArray.push(notificationData)
      }

      notificationData = {
        title: "New User Added",
        description: `A new user for your account has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: saveData._id,
        flag: 'customer_user',
        tabAction: "customerUser",

        endPoint: base_url + "customer/user",
        redirectionId: "customer/user",
        notificationFor: customerId
      };
      notificationArray.push(notificationData)
      let createNotification = await userService.saveNotificationBulk(notificationArray);

      let email = data.email
      let userId = saveData._id
      let settingData = await userService.getSetting({});

      let resetPasswordCode = randtoken.generate(4, '123456789')
      let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });

      let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`

      const mailing = sgMail.send(emailConstant.servicerApproval(email, {
        flag: "created", title: settingData[0]?.title,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        link: resetLink, subject: "Set Password", role: "Customer User",
        servicerName: data.firstName + " " + data.lastName,
        address: settingData[0]?.address,
      }))

      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "addCustomerUser",
        body: data,
        response: {
          code: constant.successCode,
          message: "User added successfully",
          result: saveData
        }
      }

      await LOG(logData).save()

      res.send({
        code: constant.successCode,
        message: "User added successfully",
        result: saveData
      })
    }


  } catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "addCustomerUser catch",
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

// get customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    let data = req.body
    let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
    if (checkCustomer?.addresses) {
      checkCustomer.addresses.push({
        address: checkCustomer?.street,
        city: checkCustomer?.city,
        state: checkCustomer?.state,
        zip: checkCustomer?.zip,
        isPrimary: true,
      });
      let filteredAddress = checkCustomer.addresses.filter(item => item && Object.keys(item).length > 0);

      checkCustomer.addresses = filteredAddress.sort((a, b) => b.isPrimary - a.isPrimary);

    }
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
    } else {

      const getPrimaryUser = await userService.findUserforCustomer1([
        {
          $match: {
            $and: [

              { metaData: { $elemMatch: { metaId: checkCustomer._id, isPrimary: true } } }
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


      let checkReseller = await resellerService.getReseller({ _id: checkCustomer.resellerId }, { isDeleted: 0 });
      let checkDealer = await dealerService.getDealerByName({ _id: checkCustomer.dealerId }, { isDeleted: 0 });
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

      let orderQuery = { customerId: { $in: [checkCustomer._id] }, status: "Active" }
      let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId");
      //Get Claim Result 
      const claimQuery = { claimFile: 'completed' }

      let lookupQuery = [
        {
          $match: claimQuery
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
              { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.params.customerId) },
            ]
          },
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
      let valueClaim = await claimService.getClaimWithAggregate(lookupQuery);

      const rejectedQuery = { claimFile: { $ne: "rejected" } }
      //Get number of claims
      let numberOfCompleletedClaims = [
        {
          $match: claimQuery
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
              { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.params.customerId) },
            ]
          },
        },
      ]
      let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);
      const claimData = {
        numberOfClaims: numberOfClaims.length,
        valueClaim: valueClaim[0]?.totalAmount
      }

      res.send({
        code: constant.successCode,
        message: "Success",
        result: {
          meta: checkCustomer,
          primary: getPrimaryUser[0],
          resellerName: checkReseller ? checkReseller.name : '',
          resellerStatus: checkReseller ? checkReseller.status : null,
          dealerStatus: checkDealer.accountStatus,
          userAccount: checkDealer.userAccount,
          orderData: ordersResult,
          claimData: claimData
        }
      })

    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//get customer user api
exports.getCustomerUsers = async (req, res) => {
  try {
    let data = req.body

    console.log("sdfdsfsdfsf", req.params.customerId)

    const getCustomerUsers = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { metaData: { $elemMatch: { metaId: new mongoose.Types.ObjectId(req.params.customerId) } } }
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
    if (!getCustomerUsers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customers"
      })
      return;
    }


    let checkCustomer = await customerService.getCustomerByName({ _id: req.params.customerId }, { status: 1 })
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
      return;
    };

    let checkDealer = await dealerService.getDealerById(checkCustomer.dealerId, {})

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getCustomerUsers,
      customerStatus: checkCustomer.status,
      isAccountCreate: checkCustomer.isAccountCreate,
      userAccount: checkDealer.userAccount

    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get customer orders
exports.customerOrders = async (req, res) => {
  try {
    let data = req.body
    let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
      return;
    }

    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      unique_key_number: 1,
      unique_key_search: 1,
      servicerId: 1,
      customerId: 1,
      serviceCoverageType: 1,
      coverageType: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      createdAt: 1,
      venderOrder: 1,
      orderAmount: 1,
      paidAmount: 1,
      dueAmount: 1,
      contract: "$contract"
    };

    let query = { status: { $ne: "Archieved" }, customerId: new mongoose.Types.ObjectId(req.params.customerId) };

    let lookupQuery = [
      {
        $match: query
      },
      {
        $project: project,
      },
      {
        "$addFields": {
          "noOfProducts": {
            "$sum": "$productsArray.checkNumberProducts"
          },
          totalOrderAmount: { $sum: "$orderAmount" },
        }
      },
      { $sort: { unique_key: -1 } }
    ]



    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)


    let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);

    //Get Respective dealer
    let dealerIdsArray = ordersResult.map((result) => result.dealerId);
    const dealerCreateria = { _id: { $in: dealerIdsArray } };

    let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
    let userResellerIds = ordersResult
      .filter(result => result.resellerId !== null)
      .map(result => result.resellerId);

    let mergedArray = userDealerIds.concat(userResellerIds);
    //Get Respective Dealers
    let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
      name: 1,
      isServicer: 1,
    });
    //Get Order Customer
    let customerIdsArray = ordersResult.map((result) => result.customerId);
    const customerCreteria = { _id: { $in: customerIdsArray } };
    let respectiveCustomer = await customerService.getAllCustomers(
      customerCreteria,
      { username: 1 }
    );
    //Get Respective Reseller
    let resellerIdsArray = ordersResult.map((result) => result.resellerId);
    const resellerCreteria = { _id: { $in: resellerIdsArray } };
    let respectiveReseller = await resellerService.getResellers(
      resellerCreteria,
      { name: 1, isServicer: 1 }
    );
    let userCustomerIds = ordersResult
      .filter(result => result.customerId !== null)
      .map(result => result.customerId);

    const allUserIds = mergedArray.concat(userCustomerIds);
    const queryUser = { metaId: { $in: allUserIds }, isPrimary: true };

    const getPrimaryUser = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { metaId: { $in: allUserIds }, isPrimary: true } } }
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


    let servicerIdArray = ordersResult.map((result) => result.servicerId);

    const servicerCreteria = {
      $or: [
        { _id: { $in: servicerIdArray } },
        { resellerId: { $in: servicerIdArray } },
        { dealerId: { $in: servicerIdArray } },
      ],
    };
    //Get Respective Servicer
    let respectiveServicer = await servicerService.getAllServiceProvider(
      servicerCreteria,
      { name: 1 }
    );
    const result_Array = ordersResult.map((item1) => {
      const dealerName =
        item1.dealerId != ""
          ? respectiveDealers.find(
            (item2) => item2._id.toString() === item1.dealerId.toString()
          )
          : null;
      const servicerName =
        item1.servicerId != null
          ? respectiveServicer.find(
            (item2) =>
              item2._id.toString() === item1.servicerId?.toString() ||
              item2.resellerId === item1.servicerId
          )
          : null;
      const customerName =
        item1.customerId != null
          ? respectiveCustomer.find(
            (item2) => item2._id.toString() === item1.customerId?.toString()
          )
          : null;
      const resellerName =
        item1.resellerId != null
          ? respectiveReseller.find(
            (item2) => item2._id.toString() === item1.resellerId?.toString()
          )
          : null;
      if (dealerName || customerName || servicerName || resellerName) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerName: servicerName ? servicerName.toObject() : {},
          dealerName: dealerName ? dealerName.toObject() : dealerName,
          customerName: customerName ? customerName.toObject() : {},
          resellerName: resellerName ? resellerName.toObject() : {},
        };
      } else {
        return {
          servicerName: servicerName ? servicerName.toObject() : {},
          dealerName: dealerName ? dealerName.toObject() : dealerName,
          customerName: customerName ? customerName.toObject() : {},
          resellerName: resellerName ? resellerName.toObject() : {},
        };
      }
    });

    const unique_keyRegex = new RegExp(
      data.unique_key ? data.unique_key.replace(/\s+/g, ' ').trim() : "",
      "i"
    );
    const venderOrderRegex = new RegExp(
      data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : "",
      "i"
    );
    const status = new RegExp(data.status ? data.status.replace(/\s+/g, ' ').trim() : "", "i");

    let filteredData = result_Array.filter((entry) => {
      return (
        unique_keyRegex.test(entry.unique_key) &&
        venderOrderRegex.test(entry.venderOrder) &&
        status.test(entry.status)
      );
    });

    const updatedArray = filteredData.map(item => {
      let username = null; // Initialize username as null
      let resellerUsername = null
      let customerUserData = null
      let isEmptyStartDate = item.productsArray.map(
        (item1) => item1.coverageStartDate === null
      );
      let isEmptyOrderFile = item.productsArray
        .map(
          (item1) =>
            item1.orderFile.fileName === ""
        )
      item.flag = false
      const coverageStartDate = isEmptyStartDate.includes(true) ? false : true
      const fileName = isEmptyOrderFile.includes(true) ? false : true
      if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
        item.flag = true
      }
      if (item.dealerName) {
        username = getPrimaryUser.find(user => user.metaId?.toString() === item.dealerName._id?.toString());
      }
      if (item.resellerName) {
        resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.resellerName._id?.toString()) : {};
      }
      if (item.customerName) {
        customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.customerName._id?.toString()) : {};
      }
      return {
        ...item,
        servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
        username: username, // Set username based on the conditional checks
        resellerUsername: resellerUsername ? resellerUsername : {},
        customerUserData: customerUserData ? customerUserData : {}
      };
    });

    const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
    const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const statusRegex = new RegExp(data.status ? data.status : '', 'i')

    const filteredData1 = updatedArray.filter(entry => {
      return (
        venderRegex.test(entry.venderOrder) &&
        orderIdRegex.test(entry.unique_key) &&
        dealerNameRegex.test(entry.dealerName.name) &&
        servicerNameRegex.test(entry.servicerName.name) &&
        customerNameRegex.test(entry.customerName.name) &&
        resellerNameRegex.test(entry.resellerName.name) &&
        statusRegex.test(entry.status)
      );
    });


    res.send({
      code: constant.successCode,
      message: 'Success',
      result: filteredData1
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//get customer contracts
exports.getCustomerContract = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    // let getTheThresholdLimir = await userService.getUserById1({ roleId: process.env.super_admin, isPrimary: true })
    let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })


    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 0
    if (data.servicerName != "") {
      userSearchCheck = 1
      let getData = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        servicerIds = await getData.map(servicer => servicer._id)
        let asServicer = (await getData).reduce((acc, servicer) => {
          if (servicer.resellerId !== null && servicer.dealerId === null) {
            acc.push(servicer.resellerId);
          } else if (servicer.dealerId !== null && servicer.resellerId === null) {
            acc.push(servicer.dealerId);
          }
          return acc;
        }, []);
        servicerIds = servicerIds.concat(asServicer)
      } else {
        servicerIds.push("1111121ccf9d400000000000")
      }
    };
    let orderAndCondition = []
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })

    }
    if (req.params.customerId) {
      userSearchCheck = 1
      orderAndCondition.push({ customerId: { $in: [req.params.customerId] } })
    };

    let orderIds = []
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order._id)
      }
    }
    let contractFilterWithEligibilty = []
    if (data.eligibilty != '') {
      contractFilterWithEligibilty = [
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { eligibilty: data.eligibilty === "true" ? true : false },
        { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    } else {
      contractFilterWithEligibilty = [
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    }

    if (userSearchCheck == 1) {
      contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
    }

    if (data.startDate != "") {
      let startDate = new Date(data.startDate)
      let endDate = new Date(data.endDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 999, 0)
      let dateFilter = { createdAt: { $gte: startDate, $lte: endDate } }
      contractFilterWithEligibilty.push(dateFilter)
    }
    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
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
                $project: {
                  productName: 1,
                  model: 1,
                  serial: 1,
                  unique_key: 1,
                  productValue: 1,
                  minDate: 1,
                  createdAt: 1,
                  status: 1,
                  manufacture: 1,
                  eligibilty: 1,
                  orderUniqueKey: 1,
                  venderOrder: 1,
                  totalRecords: 1
                }
              }
            ],
          },

        },
      ]
    } else {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $match:
          {
            $and: contractFilterWithEligibilty
          },
        },

      ]
      mainQuery.push({
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
              $project: {
                productName: 1,
                model: 1,
                serial: 1,
                minDate: 1,
                unique_key: 1,
                createdAt: 1,
                productValue: 1,
                status: 1,
                manufacture: 1,
                eligibilty: 1,
                orderUniqueKey: 1,
                venderOrder: 1,
                totalRecords: 1
              }
            }
          ],
        },

      })
    }


    let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0
    let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
    for (let e = 0; e < result1.length; e++) {
      result1[e].reason = " "
      if (!result1[e].eligibilty) {
        result1[e].reason = "Claims limit cross for this contract"
      }
      if (result1[e].status != "Active") {
        result1[e].reason = "Contract is not active"
      }
      if (new Date(result1[e].minDate) > new Date()) {
        const options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        const formattedDate = new Date(result1[e].minDate).toLocaleDateString('en-US', options)
        result1[e].reason = "Contract will be eligible on " + " " + formattedDate
      }
      let claimQuery = [
        {
          $match: { contractId: new mongoose.Types.ObjectId(result1[e]._id) }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
            openFileClaimsCount: { // Count of claims where claimfile is "Open"
              $sum: {
                $cond: {
                  if: { $eq: ["$claimFile", "open"] }, // Assuming "claimFile" field is correct
                  then: 1,
                  else: 0
                }
              }
            }
          }
        }
      ]

      let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
      if (checkClaims[0]) {
        if (checkClaims[0].openFileClaimsCount > 0) {
          result1[e].reason = "Contract has open claim"

        }
        if (checkClaims[0].isMaxClaimAmount) {

        if (checkClaims[0].totalAmount >= result1[e].productValue) {
          result1[e].reason = "Claim value exceed the product value limit"
        }
      }
      }

      let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
      const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
      let overThreshold = result1[e].claimAmount > thresholdLimitValue;
      let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
      if (!overThreshold) {
        threshHoldMessage = ""
      }
      if (!thresholdLimitPercentage.isThreshHoldLimit) {
        overThreshold = false
        threshHoldMessage = ""
      }
      result1[e].threshHoldMessage = threshHoldMessage
      result1[e].overThreshold = overThreshold
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result1,
      totalCount,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get customers claims api
exports.customerClaims = async (req, res) => {
  try {
    let allServicer;
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)

    const checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId });
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: 'Customer not found!'
      });
      return
    }
    let servicerMatch = {}
    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
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
              note: 1,
              dealerSku: 1,
              claimType: 1,
              totalAmount: 1,
              getcoverOverAmount: 1,
              customerOverAmount: 1,
              customerClaimAmount: 1,
              getCoverClaimAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              trackingNumber: 1,
              trackingType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.coverageType": 1,
              "contracts.serial": 1,
              "contracts.pName": 1,
              "contracts.orders.dealerId": 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.serviceCoverageType": 1,
              "contracts.orders.coverageType": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.dealers.isShippingAllowed": 1,
              "contracts.orders.dealers.accountStatus": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers._id": 1,
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
                    "status": "$$reseller.status",
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
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            claimPaidStatus,
            servicerMatch,
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
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
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.params.customerId) },
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
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
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
    let servicerName = '';
    allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

    let result_Array = await Promise.all(resultFiter.map(async(item1) => {
     let servicer = []
      let mergedData = []
      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        mergedData = dynamicOption.value.filter(contract =>
          item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
        );
      }
      let servicerName = '';
      let selfServicer = false;
      let selfResellerServicer = false;

      await Promise.all(item1.contracts.orders.dealers.dealerServicer.map(async (matched) => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
        if (dealerOfServicer) {
          servicer.push(dealerOfServicer);
        }
      }));
      
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      // if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
      //   let checkResellerServicer = await servicerService.getServiceProviderById({ resellerId: item1.contracts.orders.resellers[0]._id })
      //   servicer.push(checkResellerServicer)
      // }

      let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
      let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
      if (dealerResellerServicer.length > 0) {
          let dealerResellerServicer = await servicerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
          servicer = servicer.concat(dealerResellerServicer);
      }
    
      if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
        let checkDealerServicer = await servicerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })

        servicer.push(checkDealerServicer)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer?._id.toString() === item1?.servicerId.toString());
        selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false
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


// -----------------------------------------add cutomer with multiple dealer code --------------------------------------------------------------------------------

exports.createCustomerNew = async (req, res, next) => {
  try {
    let data = req.body;
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
    let getCount = await customerService.getCustomersCount({})
    data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1

    let memberEmail = data.members.map(member => member.email)
    // check dealer ID
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
    let IDs = await supportingFunction.getUserIds()
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
      })
      return;
    };

    // check reseller valid or not
    if (data.resellerName && data.resellerName != "") {
      var checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
      if (!checkReseller) {
        res.send({
          code: constant.errorCode,
          message: "Invalid Reseller."
        })
        return;
      }

    }
    let checkCustomer = await userService.getMembers({ email: { $in: memberEmail } });
    //check email for current dealer and current reseller


    // check customer acccount name 
    let checkAccountName = await customerService.getCustomerByName({
      username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName
    });

    let checkCustomerEmail = await userService.findOneUser({ email: data.email });
    // if (checkCustomerEmail) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Primary user email already exist"
    //   })
    //   return;
    // }

    let customerObject = {
      username: data.accountName,
      street: data.street,
      city: data.city,
      isAccountCreate: data?.isAccountCreate ? data.isAccountCreate : data.status,
      dealerId: checkDealer._id,
      resellerId: checkReseller ? checkReseller._id : null,
      resellerId1: checkReseller ? checkReseller._id : null,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      unique_key: data.unique_key,
      accountStatus: "Approved",
      dealerName: checkDealer.name,
    }

    let teamMembers = data.members
    const emailSet = new Set();
    let isDuplicate = false;
    let emailsToCheck = teamMembers.map(member => member.email);
    let queryEmails = { email: { $in: emailsToCheck } };
    let checkEmails = await customerService.getAllCustomers(queryEmails, {});

    // if (checkEmails.length > 0) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Some email ids already exist"
    //   })
    // }
    const createdCustomer = await customerService.createCustomer(customerObject);
    if (!createdCustomer) {
      //Save Logs create Customer
      let logData = {
        userId: req.userId,
        endpoint: "/create-customer",
        body: data,
        response: {
          code: constant.errorCode,
          message: createdCustomer
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: "Unable to create the customer"
      })
      return;
    };

    teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, status: !data.status ? false : member.status, metaId: createdCustomer._id, roleId: process.env.customer }));

    for (let m = 0; m < teamMembers.length; m++) {
      let emailToCheck = teamMembers[m].email
      let checkEmail = await userService.getUserById1({ email: emailToCheck, roleId: process.env.customer })
      let memberObject = {
        email: teamMembers[m].email,
        roleId: process.env.customer,
        customerData: [
          {
            accountId: createdCustomer._id,
            status: teamMembers[m].status,
            metaId: createdCustomer._id,
            roleId: process.env.customer,
            firstName: teamMembers[m].firstName,
            lastName: teamMembers[m].lastName,
            phoneNumber: teamMembers[m].phoneNumber,
            isPrimary: teamMembers[m].isPrimary,
          }
        ]
      }
      if (!checkEmail) {
        let createCustomerData = await userService.createUser(memberObject)
      } else {
        let customerMeta = checkEmail.customerData
        customerMeta.push(memberObject.customerData[0])
        let updateCustomerData = await userService.updateUser({ email: emailToCheck }, { customerData: customerMeta }, { new: true })
      }
    }

    // create members account 
    // let saveMembers = await userService.insertManyUser(teamMembers)

    // Primary User Welcoime email
    let notificationEmails = await supportingFunction.getUserEmails();
    let mergedEmail;
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkReseller?._id, isPrimary: true })
    IDs.push(resellerPrimary?._id)

    notificationEmails.push(getPrimary.email)
    notificationEmails.push(resellerPrimary?.email)
    //SEND EMAIL
    let emailData = {
      senderName: getPrimary.metaData[0]?.firstName,
      content: "We are delighted to inform you that the customer account for " + createdCustomer.username + " has been created.",
      subject: "Customer Account Created - " + createdCustomer.username
    }

    // Send Email code here
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))

    // if (saveMembers.length > 0) {
    //   if (data.status) {
    //     for (let i = 0; i < saveMembers.length; i++) {
    //       if (saveMembers[i].status) {
    //         let email = saveMembers[i].email
    //         let userId = saveMembers[i]._id
    //         let resetPasswordCode = randtoken.generate(4, '123456789')
    //         let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
    //         let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
    //         const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { flag: "created", link: resetLink, subject: "Set Password", role: "Customer", servicerName: saveMembers[i].firstName }))

    //       }

    //     }
    //   }
    // }

    //Send Notification to customer,admin,reseller,dealer 

    IDs.push(getPrimary._id)
    let notificationData = {
      title: "New Customer Created",
      description: data.accountName + " " + "customer account has been created successfully!",
      userId: req.teammateId,
      flag: 'customer',
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    //Save Logs create Customer
    let logData = {
      userId: req.userId,
      endpoint: "/create-customer",
      body: data,
      response: {
        code: constant.successCode,
        message: "Customer created successfully",
        result: data
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: "Customer created successfully",
      result: createdCustomer
    })
  } catch (err) {
    //Save Logs create Customer
    let logData = {
      userId: req.userId,
      endpoint: "/create-customer catch",
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
};


//

//get all customers
exports.getAllCustomersNew = async (req, res, next) => {
  try {
    let data = req.body
    let query = { isDeleted: false }
    let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    const customersId = customers.map(obj => obj._id);
    const customersOrderId = customers.map(obj => obj._id);
    const queryUser = { customerData: { $elemMatch: { metaId: { $in: customersId } } }, isPrimary: true };

    //Get Resselers
    const resellerId = customers.map(obj => new mongoose.Types.ObjectId(obj.resellerId ? obj.resellerId : '61c8c7d38e67bb7c7f7eeeee'));
    const queryReseller = { _id: { $in: resellerId } }
    const resellerData = await resellerService.getResellers(queryReseller, { isDeleted: 0 })

    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

    //Get customer Orders
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

    let orderQuery = { customerId: { $in: customersOrderId }, status: "Active" };

    let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId")

    const result_Array = customers.map(customer => {
      const matchingItem = getPrimaryUser.find(user => user.customerData.some(user1 => user1.metaId.toString() === customer._id.toString()))
      const matchingReseller = customer.resellerId != null ? resellerData.find(reseller => reseller._id.toString() === customer.resellerId.toString()) : ''
      const order = ordersData.find(order => order._id.toString() === customer._id.toString())
      if (matchingItem || matchingReseller || order) {
        return {
          ...matchingItem ? matchingItem : {},
          customerData: customer ? customer : {},
          reseller: matchingReseller ? matchingReseller : {},
          order: order ? order : {}
        };
      }

    }).filter(item => item !== undefined);
    let emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    let nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    let phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
    let dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    let resellerRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
    let filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.customerData.username) &&
        emailRegex.test(entry.email) &&
        dealerRegex.test(entry.customerData.dealerName) &&
        resellerRegex.test(entry.reseller?.name) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });
    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData
    })
  } catch (err) {
    res.send({
      code: constant.successCode,
      message: err.message,
    })
  }
};

exports.addCustomerAddress = async (req, res) => {
  try {
    let data = req.body
    let updateData = {
      $set: {
        addresses: data.addresses
      }
    }
    let updateAddress = await customerService.updateCustomer({ _id: req.params.customerId }, updateData, { new: true })
    if (!updateAddress) {
      res.send({
        code: constant.errorCode,
        message: "unable to process the addresses"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Updated successfully",
        result: updateAddress
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
exports.addAddress = async (req, res) => {
  try {
    let data = req.body
    let customerId = req.params.customerId
    if (req.role == "Customer") {
      customerId = req.userId
    }
    let checkCustomer = await customerService.getCustomerById({ _id: customerId })
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Customer not found!"
      })
      return
    }
    let customerAddresses = checkCustomer.addresses ? checkCustomer.addresses : []
    customerAddresses.push(data.address)
    console.log("customerAddresses----------------------",customerAddresses)
    let udpateCustomer = await customerService.updateCustomer({ _id: customerId }, { addresses: customerAddresses }, { new: true })
    if (!udpateCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to add customer address"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Customer address added successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
exports.deleteAddress = async (req, res) => {
  try {
    let data = req.body
    let customerId = req.params.customerId;
    if (req.role == "Customer") {
      customerId = req.userId
    }
    let checkCustomer = await customerService.getCustomerById({ _id: customerId })
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "customer not found",
      })
      return
    }
    let customerAddresses = checkCustomer.addresses ? checkCustomer.addresses : []
    console.log(customerAddresses)
    let newArray = customerAddresses.filter(obj => obj._id.toString() !== data.addressId.toString())
    // customerAddresses.push(data.address)
    let udpateCustomer = await customerService.updateCustomer({ _id: customerId }, { addresses: newArray }, { new: true })
    if (!udpateCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to add customer address"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Customer address added successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.editaddress = async (req, res) => {
  try {
    let data = req.body
    let customerId = data.customerId;
    if (req.role == "Customer") {
      customerId = req.userId
    }
    const addressId = data.addressId;

    let updateCustomer = await customerService.updateCustomer(
      { _id: customerId, 'addresses._id': addressId }, // Match the customer and specific address
      {
        $set: {
          'addresses.$.address': data.street,
          'addresses.$.city': data.city,
          'addresses.$.zip': data.zip,
          'addresses.$.state': data.state,
        }
      },
      { new: true }
    );
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: updateCustomer
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.justToCheck = async (req, res) => {
  let updateCustomer = await customerModel.updateMany(
    { addresses: { $exists: false } }, // Match documents where `addresses` is missing
    { $set: { addresses: [] } }
  )

  res.send({
    data: updateCustomer
  })
}
