const { Customer } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");
let dealerService = require('../../Dealer/services/dealerService')
let userService = require('../../User/services/userService')
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");



exports.createCustomer = async (req, res, next) => {
  try {
    let data = req.body;

    let getCount = await customerService.getCustomersCount({})
     data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
    console.log(getCount[0],data.unique_key)
    //check dealer ID
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
      })
      return;
    };

    // check customer acccount name 
    let checkAccountName = await customerService.getCustomerByName(data.accountName);
    if (checkAccountName) {
      res.send({
        code: constant.errorCode,
        message: "Customer already exist with this account name"
      })
      return;
    };

    let customerObject = {
      username: data.accountName,
      street: data.street,
      city: data.city,
      dealerId:checkDealer._id,
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      unique_key:data.unique_key,
      accountStatus: "Approved",
      dealerName:checkDealer.name,
    }

    let teamMembers = data.members
    let emailsToCheck = teamMembers.map(member => member.email);
    let queryEmails = { email: { $in: emailsToCheck } };
    let checkEmails = await customerService.getAllCustomers(queryEmails,{});
    if(checkEmails.length > 0){
      res.send({
        code:constant.errorCode,
        message:"Some email ids already exist"
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
    teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id }));
    // create members account 
    let saveMembers = await userService.insertManyUser(teamMembers)
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

    let query = { isDeleted: false}
    let projection = { __v: 0,firstName:0,lastName:0,email:0,password:0 }
    const customers = await customerService.getAllCustomers(query, projection);
    if (!customers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customer"
      });
      return;
    };
    const customersId = customers.map(obj => obj._id.toString());
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };


    console.log(queryUser)
    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

    const result_Array = getPrimaryUser.map(item1 => {
      const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());

      if (matchingItem) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          customerData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });
    console.log(getPrimaryUser)
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array
    })
  } catch (err) {
    res.send({
      code: constant.successCode,
      message: err.message,
    })
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
