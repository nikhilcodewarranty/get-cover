const { Customer } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");
let dealerService = require('../../Dealer/services/dealerService')
let resellerService = require('../../Dealer/services/resellerService')
let userService = require('../../User/services/userService')
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");

exports.createCustomer = async (req, res, next) => {
  try {
    let data = req.body;

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
    if (data.resellerName || data.resellerName != "") {
      let checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
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
      username: data.accountName,
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
      dealerId: checkDealer._id,
      resellerId: checkReseller ? checkReseller._id : '',
      zip: data.zip,
      state: data.state,
      country: data.country,
      status: data.status,
      unique_key: data.unique_key,
      accountStatus: "Approved",
      dealerName: checkDealer.name,
    }

    let teamMembers = data.members
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
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };
    //Get Resselers
    const resellerId = customers.map(obj => new mongoose.Types.ObjectId(obj.resellerId ? obj.resellerId : '61c8c7d38e67bb7c7f7eeeee'));
    const queryReseller = { _id: { $in: resellerId } }
    const resellerData = await resellerService.getResellers(queryReseller, { isDeleted: 0 })

    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

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
      const matchingReseller = resellerData.find(reseller => reseller._id.toString() === customer.resellerId.toString())
      if (matchingItem || matchingReseller) {
        return {
          ...matchingItem ? matchingItem : {},
          customerData: customer ? customer : {},
          reseller: matchingReseller ? matchingReseller : {}
        };
      }

    }).filter(item => item !== undefined);
    const emailRegex = new RegExp(data.email ? data.email : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
    const dealerRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
    console.log(result_Array);
    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.customerData.username) &&
        emailRegex.test(entry.email) &&
        dealerRegex.test(entry.customerData.dealerId) &&
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
    const queryUser = { accountId: { $in: customersId }, isPrimary: true };


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
    let name = data.firstName ? data.firstName : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };
    console.log('name check ++++++++++++++++++++++=', newObj)
    const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
    const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
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
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getResellerCustomers = async (req, res) => {
  try {

  }
  catch (err) {
console.log(`Unable to find customer ${err}`)
  }
}
exports.editCustomer = async (req, res) => {
  try {
    let data = req.body
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

      res.send({
        code: constant.successCode,
        message: "Success",
        result: {
          meta: checkCustomer,
          primary: getPrimaryUser
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

    let name = data.firstName ? data.firstName : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
    const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')

    const filteredData = getCustomerUsers.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });
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
      customerStatus: checkCustomer.status
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


