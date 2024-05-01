const { Customer } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");
let dealerService = require('../../Dealer/services/dealerService')
let resellerService = require('../../Dealer/services/resellerService')
let contractService = require('../../Contract/services/contractService')
let claimService = require('../../Claim/services/claimService')
let userService = require('../../User/services/userService')
let servicerService = require('../../Provider/services/providerService')
let orderService = require('../../Order/services/orderService')
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const serviceProvider = require("../../Provider/model/serviceProvider");
const emailConstant = require('../../config/emailConstant');
const randtoken = require('rand-token').generator()
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
exports.createCustomer = async (req, res, next) => {
  try {
    let data = req.body;
    data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
    let getCount = await customerService.getCustomersCount({})
    data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
    // check dealer ID
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
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

    // check customer acccount name 
    let checkAccountName = await customerService.getCustomerByName({
      username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName
    });
    // if (checkAccountName) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Customer already exist with this account name"
    //   })
    //   return;
    // };

    let checkCustomerEmail = await userService.findOneUser({ email: data.email });
    if (checkCustomerEmail) {
      res.send({
        code: constant.errorCode,
        message: "Primary user email already exist"
      })
      return;
    }

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
      res.send({
        code: constant.errorCode,
        message: "Unable to create the customer"
      })
      return;
    };
    teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, metaId: createdCustomer._id, roleId: '656f080e1eb1acda244af8c7' }));
    // create members account 
    let saveMembers = await userService.insertManyUser(teamMembers)
    if (saveMembers.length > 0) {
      // let saveMembers = await userService.insertManyUser(teamMembers)
      if (data.status) {
        for (let i = 0; i < saveMembers.length; i++) {
          if (saveMembers[i].status) {
            let email = saveMembers[i].email
            let userId = saveMembers[i]._id
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
            let resetLink = `http://${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
            // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink }))
            const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink, role: req.role, servicerName: data?.accountName }))

          }

        }
      }
    }
    res.send({
      code: constant.successCode,
      message: "Customer created successfully",
      result: data
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

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
    const customersId = customers.map(obj => obj._id.toString());
    const customersOrderId = customers.map(obj => obj._id);
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };
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

    console.log('check++++++++++++++++++++++++++++++++++', ordersData)

    // const result_Array = getPrimaryUser.map(item1 => {
    //   const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());

    //   if (matchingItem) {
    //     return {
    //       ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
    //       customerData: matchingItem.toObject()
    //     };
    //   } else {
    //     return dealerData.toObject();
    //   }
    // });

    const result_Array = customers.map(customer => {
      const matchingItem = getPrimaryUser.find(user => user.accountId.toString() === customer._id.toString())
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
    //console.log("result_Array----------------0",result_Array)
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
    const customersId = customers.map(obj => obj._id.toString());
    const orderCustomerId = customers.map(obj => obj._id);
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };

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


    let getPrimaryUser = await userService.findUserforCustomer(queryUser)
    const result_Array = getPrimaryUser.map(item1 => {
      const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());
      const order = ordersResult.find(order => order._id.toString() === item1.accountId)
      const matchingReseller = resellerData.find(reseller => reseller._id.toString() === item1.accountId.toString())

      if (matchingItem || order || matchingReseller) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          customerData:matchingItem ?  matchingItem.toObject() : {},
          orderData: order ? order : {},
          reseller: matchingReseller ? matchingReseller : {},
        };
      } else {
        return {};
      }
    });
    let name = data.firstName ? data.firstName : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };
    console.log('name check ++++++++++++++++++++++=', newObj)
    const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name.replace(/\s+/g, ' ').trim() : '', 'i')
    const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
    const resellerRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        firstNameRegex.test(entry.customerData.username) &&
        lastNameRegex.test(entry.customerData.username) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber),
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

exports.getResellerCustomers = async (req, res) => {
  try {
    let data = req.body;
    let query = { isDeleted: false, resellerId: req.params.resellerId }
    let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    const customersId = customers.map(obj => obj._id.toString());
    const orderCustomerIds = customers.map(obj => obj._id);
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };



    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

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
      const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());
      const order = ordersResult.find(order => order._id.toString() === item1.accountId)

      if (matchingItem || order) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          customerData:matchingItem ? matchingItem.toObject() : {},
          orderData: order ? order : {},
        };
      } else {
        return {};
      }
    });

    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const nameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    console.log(result_Array);
    result_Array = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.customerData.username) &&
        emailRegex.test(entry.email) &&
        dealerRegex.test(entry.customerData.dealerId) &&
        phoneRegex.test(entry.phoneNumber)
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

exports.editCustomer = async (req, res) => {
  try {
    let data = req.body
    data.username = data.username.trim().replace(/\s+/g, ' ');
    let checkDealer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid ID"
      })
      return;
    };

    // if(data.oldName != data.username){
    //   let checkName =  await customerService.getCustomerByName({username:data.username})
    //   if(checkName){
    //     res.send({
    //       code:constant.errorCode,
    //       message:"Customer already exist with this account name"
    //     })
    //     return;
    //   };
    // }
    let criteria1 = { _id: checkDealer._id }
    let option = { new: true }
    let updateCustomer = await customerService.updateCustomer(criteria1, data, option)
    if (!updateCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the customer detail"
      })
      return;
    }

    if (data.isAccountCreate || data.isAccountCreate == 'true') {
      console.log("I am %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%", data.isAccountCreate);
      let updatePrimaryUser = await userService.updateSingleUser({ accountId: req.params.customerId, isPrimary: true }, { status: true }, { new: true })
      console.log("updatePrimaryUser-----------------------------------",updatePrimaryUser, data.isAccountCreate)
    } else {
      let updatePrimaryUser = await userService.updateUser({ accountId: req.params.customerId }, { status: false }, { new: true })
      console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&", updatePrimaryUser, data.isAccountCreate);

    }
    // let updateDetail = await userService.updateUser({ _id: req.data.userId }, data, { new: true })
    // if (!updateDetail) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: `Fail to edit`
    //   })
    //   return;
    // };
    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.changePrimaryUser = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find the user"
      })
      return;
    };
    let updateLastPrimary = await userService.updateSingleUser({ accountId: checkUser.accountId, isPrimary: true }, { isPrimary: false }, { new: true })
    if (!updateLastPrimary) {
      res.send({
        code: constant.errorCode,
        message: "Unable to change tha primary"
      })
      return;
    };
    let updatePrimary = await userService.updateSingleUser({ _id: checkUser._id }, { isPrimary: true }, { new: true })
    if (!updatePrimary) {
      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Updated successfully",
        result: updatePrimary
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.addCustomerUser = async (req, res) => {
  try {
    let data = req.body

    let checkCustomer = await customerService.getCustomerByName({ _id: data.customerId })
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

    data.accountId = checkCustomer._id
    data.metaId = checkCustomer._id
    data.roleId = '656f080e1eb1acda244af8c7'
    let saveData = await userService.createUser(data)
    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to add the user"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "User added successfully",
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

exports.getCustomerById = async (req, res) => {
  try {
    let data = req.body
    let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
    } else {
      let getPrimaryUser = await userService.findOneUser({ accountId: checkCustomer._id.toString(), isPrimary: true }, {})
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
      const claimQuery = { claimFile: 'Completed' }

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
              // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
      let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

      const rejectedQuery = { claimFile: { $ne: "Rejected" } }
      //Get number of claims
      let numberOfCompleletedClaims = [
        {
          $match: rejectedQuery
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
              // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
              { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.params.customerId) },
            ]
          },
        },
      ]
      let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
      const claimData = {
        numberOfClaims: numberOfClaims.length,
        valueClaim: valueClaim[0]?.totalAmount
      }

      res.send({
        code: constant.successCode,
        message: "Success",
        result: {
          meta: checkCustomer,
          primary: getPrimaryUser,
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

exports.getCustomerUsers = async (req, res) => {
  try {
    let data = req.body
    let getCustomerUsers = await userService.findUser({ accountId: req.params.customerId, isDeleted: false }, { isPrimary: -1 })
    if (!getCustomerUsers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customers"
      })
      return;
    }

    let name = data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
    const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = getCustomerUsers.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });

    console.log("filteredData=================", filteredData)
    let checkCustomer = await customerService.getCustomerByName({ _id: req.params.customerId }, { status: 1 })
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
      return;
    };


    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData,
      customerStatus: checkCustomer.status,
      isAccountCreate: checkCustomer.isAccountCreate

    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

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
          // flag: {
          //   $cond: {
          //     if: {
          //       $and: [
          //         // { $eq: ["$payment.status", "paid"] },
          //         { $ne: ["$productsArray.orderFile.fileName", ''] },
          //         { $ne: ["$customerId", null] },
          //         { $ne: ["$paymentStatus", 'Paid'] },
          //         { $ne: ["$productsArray.coverageStartDate", null] },
          //       ]
          //     },
          //     then: true,
          //     else: false
          //   }
          // }
        }
      },
      { $sort: { unique_key: -1 } }
    ]



    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)


    let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);

    //let ordersResult = await orderService.getAllOrders({ customerId: new mongoose.Types.ObjectId(req.params.customerId), status: { $ne: "Archieved" } }, { isDeleted: 0 })

    //Get Respective dealer
    let dealerIdsArray = ordersResult.map((result) => result.dealerId);
    const dealerCreateria = { _id: { $in: dealerIdsArray } };

    let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
    let userResellerIds = ordersResult
      .filter(result => result.resellerId !== null)
      .map(result => result.resellerId?.toString());

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
      .map(result => result.customerId?.toString());

    const allUserIds = mergedArray.concat(userCustomerIds);


    const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

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
    // const updatedArray = filteredData.map((item) => ({
    //   ...item,
    //   servicerName: item.dealerName.isServicer
    //     ? item.dealerName
    //     : item.resellerName.isServicer
    //       ? item.resellerName
    //       : item.servicerName,
    // }));

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
        username = getPrimaryUser.find(user => user.accountId?.toString() === item.dealerName._id?.toString());
      }
      if (item.resellerName) {
        resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.resellerName._id?.toString()) : {};
      }
      if (item.customerName) {
        customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.customerName._id?.toString()) : {};
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

// exports.getCustomerContract = async (req, res) => {
//   try {
//     let data = req.body
//     let getCustomerOrder = await orderService.getOrders({ customerId: req.params.customerId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
//     if (!getCustomerOrder) {
//       res.send({
//         code: constant.errorCode,
//         message: "Unable to fetch the data"
//       })
//       return
//     }
//     let orderIDs = getCustomerOrder.map((ID) => ID._id)
//     let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//     let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//     let limitData = Number(pageLimit)
//     let newQuery = [];
//     data.servicerName = data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : ''

//     if (data.servicerName) {
//       newQuery.push(
//         {
//           $lookup: {
//             from: "serviceproviders",
//             localField: "order.servicerId",
//             foreignField: "_id",
//             as: "order.servicer"
//           }
//         },
//         {
//           $match: {
//             $and: [
//               { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//           },
//         }
//       );
//     }
//     data.resellerName = data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : ''

//     if (data.resellerName) {
//       newQuery.push(
//         {
//           $lookup: {
//             from: "resellers",
//             localField: "order.resellerId",
//             foreignField: "_id",
//             as: "order.reseller"
//           }
//         },
//         {
//           $match: {
//             $and: [
//               { "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//           },
//         }
//       );
//     }
//     newQuery.push(
//       {
//         $facet: {
//           totalRecords: [
//             {
//               $count: "total"
//             }
//           ],
//           data: [
//             {
//               $skip: skipLimit
//             },
//             {
//               $limit: pageLimit
//             },
//             {
//               $project: {
//                 productName: 1,
//                 model: 1,
//                 serial: 1,
//                 unique_key: 1,
//                 status: 1,
//                 manufacture: 1,
//                 eligibilty: 1,
//                 // "order.unique_key": 1,
//                 // "order.venderOrder": 1,
//                 // "order.customerId": 1,
//                 order_unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                 order_venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                 order: {
//                   unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                   venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                   customerId: { $arrayElemAt: ["$order.customerId", 0] },
//                 },
//                 totalRecords: 1
//                 //totalRecords: 1
//               }
//             }
//           ],
//         },

//       })

//     let contractFilter = []
//     if (data.eligibilty != '') {
//       contractFilter = [
//         // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//         { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { eligibilty: data.eligibilty === "true" ? true : false },
//       ]
//     } else {
//       contractFilter = [
//         // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//         { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       ]
//     }


//     let query = [
//       {
//         $match:
//         {
//           $and: contractFilter
//         },
//       },
//       {
//         $lookup: {
//           from: "orders",
//           localField: "orderId",
//           foreignField: "_id",
//           as: "order",
//         }
//       },
//       // {
//       //   $unwind: {
//       //     path: "$order",
//       //     preserveNullAndEmptyArrays: true,
//       //   }
//       // },
//       {
//         $match:
//         {
//           $and: [
//             { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             { "order.customerId": new mongoose.Types.ObjectId(req.params.customerId) },

//           ]
//         },

//       },
//       // {
//       //   $lookup: {
//       //     from: "customers",
//       //     localField: "order.customerId",
//       //     foreignField: "_id",
//       //     as: "order.customer"
//       //   }
//       // },
//       // {
//       //   $match: {
//       //     $and: [
//       //       { "order.customer._id": new mongoose.Types.ObjectId(req.params.customerId) },
//       //     ]
//       //   },
//       // },
//       // {
//       //   $facet: {
//       //     totalRecords: [
//       //       {
//       //         $count: "total"
//       //       }
//       //     ],
//       //     data: [
//       //       {
//       //         $skip: skipLimit
//       //       },
//       //       {
//       //         $limit: pageLimit
//       //       },
//       //       {
//       //         $project: {
//       //           productName: 1,
//       //           model: 1,
//       //           serial: 1,
//       //           unique_key: 1,
//       //           status: 1,
//       //           manufacture: 1,
//       //           eligibilty: 1,
//       //           "order.unique_key": 1,
//       //           "order.venderOrder": 1
//       //         }
//       //       }

//       //     ],

//       //   },

//       // }
//     ]

//     if (newQuery.length > 0) {
//       query = query.concat(newQuery);
//     }
//     console.log(pageLimit, skipLimit, limitData)
//     let getContracts = await contractService.getAllContracts2(query)
//     //let getContract = await contractService.getAllContracts(query, skipLimit, pageLimit)
//     console.log(orderIDs, skipLimit, limitData)
//     //let totalCount = await contractService.findContractCount({ isDeleted: false, orderId: { $in: orderIDs } })
//     let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

//     console.log(pageLimit, skipLimit, limitData)
//     // if (!getContract) {
//     //   res.send({
//     //     code: constants.errorCode,
//     //     message: err.message
//     //   })
//     //   return;
//     // }
//     res.send({
//       code: constant.successCode,
//       message: "Success",
//       result: getContracts[0]?.data ? getContracts[0]?.data : [],
//       totalCount: totalCount
//     })

//     console.log(orderIDs)
//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }


exports.getCustomerContract = async (req, res) => {
  try {
    let data = req.body
    console.log("data------------------", data)
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
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

    console.log("orderAndCondition-------------------", orderAndCondition)
    let orderIds = []
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order._id)
      }
    }
    console.log("getOrders-------------------", orderIds)
    let contractFilterWithEligibilty = []
    if (data.eligibilty != '') {
      contractFilterWithEligibilty = [
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
      console.log('check_--------dssssssssssssssssssssss--------')
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
                unique_key: 1,
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


    // console.log("sssssss", contractFilterWithPaging)

    let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      totalCount,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
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

exports.customerClaims = async (req, res) => {
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
    const checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId });
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: 'Customer not found!'
      });
      return
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
              totalAmount: 1,
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
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue : '', '$options': 'i' } },
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
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.isDeleted": false },
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
          pipeline: [
            // {
            //   $match:
            //   {
            //     $and: [
            //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
            //       { isDeleted: false },
            //     ]
            //   },
            // },
            // {
            //   $lookup: {
            //     from: "servicer_dealer_relations",
            //     localField: "_id",
            //     foreignField: "dealerId",
            //     as: "dealerServicer",
            //   }
            // },
          ]
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
          // "contracts.orders.dealers.isDeleted": false,
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
      }
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
    allServicer = await servicerService.getAllServiceProvider(
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



// exports.editCustomer = async (req, res) => {
//   try {
//     let data = req.body
//     let checkDealer = await customerService.getCustomerById(req.params.dealerId, {})
//     if (!checkDealer) {
//       res.send({
//         code: constant.errorCode,
//         message: "Invalid ID"
//       })
//       return;
//     };
//     let updateDetail = await userService.updateUser({ accountId: checkDealer._id }, data, { new: true })
//     if (!updateDetail) {
//       res.send({
//         code: constant.errorCode,
//         message: `Fail to edit`
//       })
//       return;
//     };
//     res.send({
//       code: constant.successCode,
//       message: "Updated successfully"
//     })
//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }


