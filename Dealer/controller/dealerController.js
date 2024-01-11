require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer")
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const connection = require('../../db')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');
const { id } = require('../validators/register_dealer');
const { isBoolean } = require('util');
const { string } = require('joi');
const providerService = require('../../Provider/services/providerService');
const { getServicer } = require('../../Provider/controller/serviceController');


var StorageP = multer.diskStorage({
  destination: function (req, files, cb) {
    cb(null, path.join(__dirname, '../../uploads/resultFile'));
  },
  filename: function (req, files, cb) {
    cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
  }
})

var uploadP = multer({
  storage: StorageP,
}).single('file');



const checkObjectId = async (Id) => {
  // Check if the potentialObjectId is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(Id)) {
    return true;
  } else {
    return false;
  }
}

// get all dealers 
exports.getAllDealers = async (req, res) => {
  try {

    let data = req.body

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let dealerFilter = {
      $and: [
        { isDeleted: false },
        { status: "Approved" },
        { 'name': { '$regex': req.body.name ? req.body.name.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } }
      ]

    };

    //let query = { isDeleted: false, status: "Approved" }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(dealerFilter, projection);
    const dealerIds = dealers.map(obj => obj._id);
    let query1 = { accountId: { $in: dealerIds }, isPrimary: true };

    // if (req.body.email && req.body.phoneNumber) {
    //   query1 = {
    //     ...query1,
    //     $and: [
    //       { email: { '$regex': req.body.email ? req.body.email.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } },
    //       { phoneNumber: { '$regex': req.body.phoneNumber ? req.body.phoneNumber.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } }
    //     ]
    //   };
    // } else {
    //   // If only one of them is provided, use $or
    //   const orConditions = [];

    //   if (req.body.email !== undefined && req.body.email != '') {
    //     orConditions.push({ email: req.body.email });
    //   }

    //   if (req.body.phoneNumber !== undefined && req.body.phoneNumber != '') {
    //     orConditions.push({ phoneNumber: req.body.phoneNumber });
    //   }

    //   if (orConditions.length > 0) {
    //     query1 = {
    //       ...query1,
    //       $or: orConditions
    //     };
    //   }

    // }

    //-------------Get All Dealers Id's------------------------

    // Get Dealer Primary Users from colection
    //const query1 = { accountId: { $in: dealerIds }, isPrimary: true };
    //User Query Filter

    let dealarUser = await userService.getDealersUser(query1, projection)
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    // return false;

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
};


//Get Pending Request dealers
exports.getPendingDealers = async (req, res) => {
  try {

    let data = req.body

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let dealerFilter = {
      $and: [
        { isDeleted: false },
        { status: "Pending" },
        { 'name': { '$regex': req.body.name ? req.body.name : '', '$options': 'i' } }
      ]

    };
    // let query = { isDeleted: false, status: "Pending" }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(dealerFilter, projection);
    //-------------Get All Dealers Id's------------------------

    const dealerIds = dealers.map(obj => obj._id);

    let query1 = { accountId: { $in: dealerIds }, isPrimary: true };

    // if (req.body.email && req.body.phoneNumber) {
    //   query1 = {
    //     ...query1,
    //     $and: [
    //       { email: { '$regex': req.body.email ? req.body.email : '', '$options': 'i' } },
    //       { phoneNumber: req.body.phoneNumber }
    //     ]
    //   };
    // } else {
    //   // If only one of them is provided, use $or
    //   const orConditions = [];

    //   if (req.body.email !== undefined && req.body.email != '') {
    //     orConditions.push({ email: req.body.email });
    //   }

    //   if (req.body.phoneNumber !== undefined && req.body.phoneNumber != '') {
    //     orConditions.push({ phoneNumber: req.body.phoneNumber });
    //   }

    //   if (orConditions.length > 0) {
    //     query1 = {
    //       ...query1,
    //       $or: orConditions
    //     };
    //   }

    // }

    let dealarUser = await userService.getDealersUser(query1, projection)
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

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
};

//create new dealer
exports.createDealer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let data = req.body
    let dealerData = {}
    const createdDealer = await dealerService.createDealer(dealerData);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create a new Dealer"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get dealer detail by ID
exports.getDealerById = async (req, res) => {
  try {
    //fetching data from user table
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId });

    //result.metaData = singleDealer
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
      return
    }
    const query1 = { accountId: { $in: [dealers[0]._id] }, isPrimary: true };

    let dealarUser = await userService.getDealersUser(query1, { isDeleted: false })


    if (!dealarUser) {
      res.send({
        code: constant.errorCode,
        message: "No any user of this dealer"
      });
      return
    }

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

    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//get dealer detail by ID
exports.getUserByDealerId = async (req, res) => {
  try {
    let data = req.body
    //fetching data from user table
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { accountStatus: 1 });

    //result.metaData = singleDealer
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      });
      return;
    };
    const users = await dealerService.getUserByDealerId({ accountId: req.params.dealerId, isDeleted: false });

    let name = data.firstName ? data.firstName : ""
    let nameArray = name.trim().split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    console.log('sdhfjdhfjshdfsj', newObj)
    const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
    const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')


    const filteredData = users.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });


    //result.metaData = singleDealer
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
      return
    }
    console.log(dealers)
    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData,
      dealerStatus: dealers[0].accountStatus
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//update dealer detail with ID
exports.updateDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        // body data will be pass here
      }
    };
    let option = { new: true };
    const updatedDealer = await dealerService.updateDealer(criteria, newValue, option);
    if (!updatedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// delete dealer with dealer ID
exports.deleteDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true };
    const deletedDealer = await dealerService.deleteDealer(criteria, newValue, option);
    if (!deletedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the dealer"
      })
      return;
    };
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

/**---------------------------------------------------Register Dealer-------------------------------------------- */
exports.registerDealer = async (req, res) => {
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
    const pendingDealer = await dealerService.getDealerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') }, status: "Pending" }, { isDeleted: 0, __v: 0 });
    if (pendingDealer) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this name! Waiting for the approval"
      })
      return;
    }

    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
      res.send({
        code: constant.errorCode,
        message: "Account name already exist"
      })
      return;
    }


    // Check if the email already exists
    const pendingUser = await userService.findOneUser({ email: req.body.email });
    if (pendingUser) {
      let checkDealer = await dealerService.getDealerByName({ _id: pendingUser.accountId })
      if (checkDealer) {
        if (checkDealer.status == "Pending") {
          res.send({
            code: constant.errorCode,
            message: "You have registered already with this email! Waiting for the approval"
          })
          return;
        }
      }


    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email"
      })
      return;
    }

    const count = await dealerService.getDealerCount();

    //console.log("count=======================",count);return false;

    // console.log(count);return false;
    // Extract necessary data for dealer creation
    const dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    };

    // Register the dealer
    const createdDealer = await dealerService.registerDealer(dealerMeta);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unbale to create the dealer"
      })
      return;
    }

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      accountId: createdDealer._id,
    };

    // Create the user
    const createdUser = await userService.createUser(userMetaData);

    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to create dealer user',
      });
      return
    }
    //Send Notification to dealer 

    const notificationData = {
      title: "New Dealer Registration",
      description: data.name + " " + "has finished registering as a new dealer. For the onboarding process to proceed more quickly, kindly review and give your approval.",
      userId: createdDealer._id,
      flag: 'dealer'
    };


    // Create the user
    const createNotification = await userService.createNotification(notificationData);

    if (createNotification) {
      // Send Email code here
      let mailing = sgMail.send(emailConstant.dealerWelcomeMessage(data.email))

    }
    res.send({
      code: constant.successCode,
      data: createdDealer,
    });
    return

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return;
  }
};

exports.statusUpdate = async (req, res) => {
  try {
    // Check if the user has the required role
    if (req.role !== "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin is allowed to perform this action"
      });
      return
    }

    // Check if the dealerPriceBookId is a valid ObjectId
    const isValid = await checkObjectId(req.params.dealerPriceBookId);
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Dealer Price Book ID"
      });
      return;
    }

    // Fetch existing dealer price book data
    const criteria = { _id: req.params.dealerPriceBookId };
    const projection = { isDeleted: 0, __v: 0 };
    const existingDealerPriceBook = await dealerPriceService.getDealerPriceById(criteria, projection);

    if (!existingDealerPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Price Book not found"
      });
      return;
    }

    // Check if the priceBook is a valid ObjectId
    const isPriceBookValid = await checkObjectId(req.body.priceBook);
    if (!isPriceBookValid) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book ID"
      });
      return;
    }

    // Prepare the update data
    const newValue = {
      $set: {
        brokerFee: req.body.brokerFee || existingDealerPriceBook.brokerFee,
        status: req.body.status,
        retailPrice: req.body.retailPrice || existingDealerPriceBook.retailPrice,
        priceBook: req.body.priceBook || existingDealerPriceBook.priceBook,
      }
    };

    const option = { new: true };

    // Update the dealer price status
    const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

    if (!updatedResult) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer price status"
      });

      return;

    }
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      data: updatedResult
    });

    return

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return
  }
};
// All Dealer Books

exports.getAllDealerPriceBooks = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false }
    let getDealerPrice = await dealerPriceService.getAllDealerPrice(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.changeDealerStatus = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: req.params.dealerId });

    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      })
      return;
    }
    //Update Dealer User Status if inactive
    if (!req.body.status) {
      let dealerUserCreateria = { accountId: req.params.dealerId };
      let newValue = {
        $set: {
          status: req.body.status
        }
      };
      let option = { new: true };
      const changeDealerUser = await userService.updateUser(dealerUserCreateria, newValue, option);

      //Inactive dealer price Books
      const changeDealerPriceBookStatus = await dealerPriceService.updateDealerPrice({ dealerId: req.params.dealerId }, {
        $set: {
          status: req.body.status
        }
      }, option);

      // // Inactive Dealer Customer
      // const changeDealerCustomerStatus = await customerService.updateCustomerData({ dealerId: req.params.dealerId }, {
      //   $set: {
      //     status: req.body.status
      //   }
      // }, option);

      // // Get Dealer Customers
      // let projection = { __v: 0, isDeleted: 0 }

      // let allCustomers = await customerService.getAllCustomers({ dealerId: req.params.dealerId }, projection)

      // let customerIdsArray = allCustomers.map(customer => customer._id.toString())
      // let queryIds = { accountId: { $in: customerIdsArray } };

      // //Inactive Customer Status
      // const changeCustomerUserStatus = await customerService.updateCustomerData(queryIds,{status: req.body.status}, option);

      // console.log("changeCustomerUserStatus++++++++",changeCustomerUserStatus)

    }

    else {
      let dealerUserCreateria = { accountId: req.params.dealerId, isPrimary: true };
      let newValue = {
        $set: {
          status: req.body.status
        }
      };
      let option = { new: true };
      const changeDealerUser = await userService.updateUser(dealerUserCreateria, newValue, option);
    }

    option = { new: true };
    //Update Dealer Status
    newValue = {
      $set: {
        accountStatus: req.body.status
      }
    };
    const changedDealerStatus = await dealerService.updateDealerStatus({ _id: req.params.dealerId }, newValue, option);
    if (changedDealerStatus) {
      res.send({
        code: constant.successCode,
        message: 'Updated Successfully!',
        data: changedDealerStatus
      })
    }
    else {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update dealer status!',
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


exports.getDealerPriceBookById = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false, _id: new mongoose.Types.ObjectId(req.params.dealerPriceBookId) }
    let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Dealer Price Books
exports.getDealerPriceBookByDealerId = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let checkDealer = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { isDeleted: false })

    if (checkDealer.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(req.params.dealerId) }
    let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getAllPriceBooksByFilter = async (req, res, next) => {
  try {
    let data = req.body
    data.status = typeof (data.status) == "string" ? "all" : data.status
    console.log(data)
    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let query
    console.log("lklklkkklk", data.status)
    // let query ={'dealerId': new mongoose.Types.ObjectId(data.dealerId) };
    if (data.status != 'all' && data.status != undefined) {
      query = {
        $and: [
          { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
          { 'priceBooks.category._id': { $in: catIdsArray } },
          { 'status': data.status },
          {
            dealerId: new mongoose.Types.ObjectId(data.dealerId)
          }
        ]
      };
    } else {
      query = {
        $and: [
          { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
          { 'priceBooks.category._id': { $in: catIdsArray } },
          {
            dealerId: new mongoose.Types.ObjectId(data.dealerId)
          }
        ]
      };
    }


    //
    let projection = { isDeleted: 0, __v: 0 }
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1
    const priceBooks = await dealerPriceService.getAllPriceBooksByFilter(query, projection, limit, page);
    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

exports.getAllDealerPriceBooksByFilter = async (req, res, next) => {
  try {
    let data = req.body

    data.status = typeof (data.status) == "string" ? "all" : data.status

    //  data.status =  data.status==='true'  ? true : false;
    //return;

    console.log(data.status)
    console.log(typeof (data.status))

    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchDealerName = req.body.name ? req.body.name : ''
    let query
    let matchConditions = [];

    matchConditions.push({ 'priceBooks.category._id': { $in: catIdsArray } });


    if (data.status != 'all' && data.status != undefined) {
      console.log("dssdsdf");
      matchConditions.push({ 'status': data.status });
    }

    if (data.term) {
      matchConditions.push({ 'priceBooks.term': Number(data.term) });
    }

    if (data.name) {
      matchConditions.push({ 'dealer.name': { '$regex': req.body.name ? req.body.name : '', '$options': 'i' } });
    }
    const matchStage = matchConditions.length > 0 ? { $match: { $and: matchConditions } } : {};
    console.log(matchStage);
    // console.log(matchStage);return;

    let projection = { isDeleted: 0, __v: 0 }
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1

    console.log('matching ----------------------------------', matchStage)

    const priceBooks = await dealerPriceService.getAllDealerPriceBooksByFilter(matchStage, projection, limit, page);
    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks,
      matchStage
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};



function uniqByKeepLast(data, key) {

  return [

    ...new Map(

      data.map(x => [key(x), x])

    ).values()

  ]

}


exports.uploadPriceBook = async (req, res) => {
  try {
    // Check if a file is uploaded

    // console.log("filesPath=========",req.file);return;
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    if (!req.file) {
      res.send({
        code: constant.errorCode,
        message: "No file uploaded"
      })
      return;
    }
    let csvName = req.file.filename
    const csvWriter = createCsvWriter({
      path: './uploads/resultFile/' + csvName,
      header: [
        { id: 'priceBook', title: 'Price Book' },
        { id: 'status', title: 'Status' },
        { id: 'reason', title: 'Reason' },
        // Add more headers as needed
      ],
    });


    //check Dealer Exist
    let checkDealer = await dealerService.getSingleDealerById({ _id: req.body.dealerId }, { isDeleted: false })
    // Your array of objects


    if (checkDealer.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      })
      return;
    }
    // if (checkDealer[0].status == 'Pending') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Dealer has not been approved yet!"
    //   })
    //   return;
    // }
    let priceBookName = [];
    let csvStatus = [];
    let newArray1;
    let allPriceBooks;
    let passedEnteries = []
    let upload
    const wb = XLSX.readFile(req.file.path);
    const sheets = wb.SheetNames;
    const ws = wb.Sheets[sheets[0]];
    const headers = [];
    for (let cell in ws) {
      // Check if the cell is in the first row and has a non-empty value
      if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
        headers.push(ws[cell].v);
      }
    }
    if (sheets.length > 0) {
      let original_csv_array = ['priceBook', 'retailPrice'];

      if (original_csv_array.length != headers.length) {
        res.send({
          code: constant.errorCode,
          message: 'The uploaded file coloumn is not match.Please check the uploaded file'
        });
        return;
      }

      let equality = Array.isArray(original_csv_array) &&
        Array.isArray(headers) &&
        original_csv_array.length === headers.length &&
        original_csv_array.every((val, index) => val === headers[index]);

      if (!equality) {
        res.send({
          code: constant.errorCode,
          message: 'Invalid uploaded file! '
        });
        return;
      }

      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);

      //Get data from csv when priceBooks and retailPrice is not undefined

      let results = data
        .filter(obj => obj.priceBook !== undefined && obj.retailPrice !== undefined)
        .map(obj => ({
          priceBook: obj.priceBook,
          retailPrice: obj.retailPrice,
        }));

      let allResults = data
        .map(obj => ({
          priceBook: obj.priceBook,
          retailPrice: obj.retailPrice,
        }));

      // Get only unique data from csv
      let unique = uniqByKeepLast(results, it => it.priceBook)

      // Get only name from unique

      priceBookName = unique.map(obj => obj.priceBook);
      const priceBookName1 = results.map(name => new RegExp(`^${name.priceBook}$`, 'i'));
      //Get founded products
      const foundProducts = await priceBookService.findByName(priceBookName1);

      if (foundProducts.length > 0) {
        const count = await dealerPriceService.getDealerPriceCount();
        // Extract the names and ids of found products
        let foundProductData1 = foundProducts.map(product => {
          if (product.status) {
            return {
              priceBook: product._id,
              name: product.name,
              dealerId: req.body.dealerId,
              status: true,
              wholePrice: (Number(product.frontingFee) + Number(product.reserveFutureFee) + Number(product.reinsuranceFee) + Number(product.adminFee)).toFixed(2)
            }
          }
        });

        //Get inactive products

        const inactiveData = foundProducts.filter(inactive => inactive.status === false);

        const foundProductData = foundProductData1.filter(item1 => item1 !== undefined);


        if (inactiveData.length > 0) {
          inactiveData.map(inactive => {
            let csvData = {
              'priceBook': inactive.name,
              'status': 'Failed',
              'reason': 'The product is inactive',

            }
            csvStatus.push(csvData)
          })

        }
        const inactiveNames = inactiveData.map(inactive => inactive.name.toLowerCase());
        // Remove product from csv based on inactive name
        priceBookName = priceBookName.filter(name => !inactiveNames.includes(name.toLowerCase()));
        console.log("results=========================", allResults);
        const missingProductNames = allResults.filter(name => {
          const lowercaseName = name.priceBook != '' ? name.priceBook.toLowerCase() : name.priceBook;
          return !foundProductData.some(product => product.name.toLowerCase() === lowercaseName);
        });

        console.log("missingProductNames=========================", missingProductNames); return
        if (missingProductNames.length > 0) {
          missingProductNames.map(product => {
            let csvData = {
              'priceBook': product,
              'status': 'Failed',
              'reason': 'The product is not exist in the catalog',

            }
            csvStatus.push(csvData)
          })
        }
        // Extract _id values from priceBookIds
        const allpriceBookIds = foundProductData.map(obj => new mongoose.Types.ObjectId(obj.priceBook));
        // Check for duplicates and return early if found
        if (allpriceBookIds.length > 0) {
          let query = {
            $and: [
              { 'priceBook': { $in: allpriceBookIds } },
              { 'dealerId': new mongoose.Types.ObjectId(req.body.dealerId) }
            ]
          }
          let existingData = await dealerPriceService.findByIds(query);
          if (existingData.length > 0) {
            allPriceBooks = existingData.map(obj => obj.priceBooks).flat();
            newArray1 = results
              .filter(obj => !allPriceBooks.some(existingObj => existingObj.name.toLowerCase().includes(obj.priceBook.toLowerCase())))
              .map(obj => ({
                priceBook: obj.priceBook,
                status: true,
                retailPrice: obj.retailPrice,
                dealerId: req.body.dealerId,
              }));
            // Merge brokerFee from newArray into foundProductData based on priceBook
            const mergedArray = foundProductData.map(foundProduct => {
              const matchingItem = newArray1.find(item => item.priceBook.toLowerCase() === foundProduct.name.toLowerCase());

              if (matchingItem != undefined) {
                let csvData = {
                  'priceBook': foundProduct.name,
                  'status': 'Passed',
                  'reason': 'Successfull Processed!',
                }
                csvStatus.push(csvData)
                passedEnteries.push(csvData)
                return {
                  ...foundProduct,
                  retailPrice: matchingItem.retailPrice,
                  brokerFee: ((matchingItem.retailPrice) - foundProduct.wholePrice).toFixed(2),
                  unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1,
                  wholesalePrice: foundProduct.wholePrice
                };
              }
            });
            const mergedArrayWithoutUndefined = mergedArray.filter(item => item !== undefined);
            existingData.forEach(product => {
              product.priceBooks.forEach(priceBook => {
                const matchedData = unique.filter(item => priceBook.name == item.priceBook);
                let newValue = {
                  $set: {
                    retailPrice: matchedData[0].retailPrice
                  }
                };
                let option = { new: true }
                let update = dealerPriceService.updateDealerPrice({ dealerId: req.body.dealerId, priceBook: priceBook._id, status: true }, newValue, option);
                let csvData = {
                  'priceBook': priceBook.name,
                  'status': 'Passed',
                  'reason': 'Successfull Processed!',
                }
                csvStatus.push(csvData)
                passedEnteries.push(csvData)
              });
            });

            upload = await dealerPriceService.uploadPriceBook(mergedArrayWithoutUndefined);
          }
          else {

            newArray1 = results
              .filter(obj => foundProductData.some(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase()))
              .map((obj, index) => {
                const matchingProduct = foundProductData.find(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase());
                if (matchingProduct) {
                  let csvData = {
                    'priceBook': obj.priceBook,
                    'status': 'Passed',
                    'reason': 'Successfull Processed!',
                  }
                  csvStatus.push(csvData)
                  passedEnteries.push(csvData)
                }
                const updatedCount = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1;
                //Print the value of updatedCount
                return {
                  priceBook: matchingProduct.priceBook,
                  status: true,
                  dealerId: req.body.dealerId,
                  unique_key: updatedCount,
                  retailPrice: obj.retailPrice,
                  brokerFee: (Number(obj.retailPrice) - Number(matchingProduct.wholePrice)).toFixed(2),
                  wholesalePrice: matchingProduct ? matchingProduct.wholePrice : null, // Use wholePrice from matching product or null if not found
                };
              });

            upload = await dealerPriceService.uploadPriceBook(newArray1);
          }
        }
      }
      else {
        if (results.length > 0) {
          results.map(product => {
            let csvData = {
              'priceBook': product.priceBook,
              'status': 'Failed',
              'reason': 'The product is not exist in the catalog',
            }
            csvStatus.push(csvData)
          })
        }
      }
      // Write the data to the CSV file
      const res12 = await csvWriter.writeRecords(csvStatus);


      // Construct the base URL link
      const base_url_link = 'http://15.207.221.207:3002/uploads/resultFile';

      // Get the CSV name from the csvWriter path
      const csvName1 = csvName;

      // Construct the complete URL
      const complete_url = `${base_url_link}/${csvName1}`;

      //console.log(csvStatus);return;

      let entriesData = {
        userName: checkDealer[0].name,
        totalEntries: Number(results.length),
        SuccessEntries: Number(passedEnteries.length),
        failedEntries: Number(results.length) - Number(passedEnteries.length),
        routeLink: complete_url
      }

      // Send email with the CSV file link
      const mailing = sgMail.send(emailConstant.sendCsvFile('nikhil@codenomad.net', entriesData));
      if (mailing) {
        //  console.log('Email sent successfully');
        res.send({
          code: constant.successCode,
          data: upload
        });
      }

      res.send({
        code: constant.successCode,
        data: upload
      });


    }

  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

exports.createDealerPriceBook = async (req, res) => {
  try {
    let data = req.body
    const count = await dealerPriceService.getDealerPriceCount();
    data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    let checkDealer = await dealerService.getDealerById(data.dealerId)
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
      })
      return;
    }
    if (checkDealer.status == "Pending") {
      res.send({
        code: constant.errorCode,
        message: "Account not approved yet"
      })
      return;
    }
    let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: data.priceBook }, {})
    if (!checkPriceBookMain) {
      res.send({
        code: constant.errorCode,
        message: "Invalid price book ID"
      })
      return;
    }
    let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: data.dealerId }, {})
    if (checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer price book already created with this product name"
      })
      return;
    }
    let createDealerPrice = await dealerPriceService.createDealerPrice(data)
    if (!createDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the dealer price book"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: createDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.rejectDealer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: req.params.dealerId });

    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      })
      return;
    }

    //if status is rejected
    if (req.body.status == 'Rejected') {
      //Delete the user
      const deleteUser = await userService.deleteUser({ accountId: req.params.dealerId })
      if (!deleteUser) {
        res.send({
          code: constant.errorCode,
          message: "Unable to delete the user"
        })
        return;
      }

      //Delete the dealer
      const deleteDealer = await dealerService.deleteDealer({ _id: req.params.dealerId })
      if (!deleteDealer) {
        res.send({
          code: constant.errorCode,
          message: "Unable to delete the dealer"
        })
        return;
      }
      res.send({
        code: constant.successCode,
        data: "Rejected Successful"
      })
      return;
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateDealerMeta = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerById(data.dealerId, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }
    if (data.oldName != data.accountName) {
      let checkAccountName = await dealerService.getDealerByName({ name: data.accountName }, {})
      if (checkAccountName) {
        res.send({
          code: constant.errorCode,
          message: "Account name is not available"
        })
        return;
      };
    };
    let criteria = { _id: checkDealer._id }
    let option = { new: true }
    data.name = data.accountName
    let updatedData = await dealerService.updateDealer(criteria, data, option)
    if (!updatedData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
    } else {
      let Customercriteria = { dealerId: checkDealer._id }
      let option = { new: true }
      let updatedData = await customerService.updateDealerName(Customercriteria, { dealerName: data.accountName }, option)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: updatedData
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.addDealerUser = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId }, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    };
    let checkEmail = await userService.getSingleUserByEmail({ email: data.email }, {})
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email"
      })
      return;
    }
    data.accountId = checkDealer._id
    let statusCheck;
    if (!checkDealer.accountStatus) {
      statusCheck = false
    } else {
      statusCheck = data.status
    }
    data.status = statusCheck
    let saveData = await userService.createUser(data)
    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to add the data"
      })
    } else {
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

exports.uploadDealerPriceBook = async (req, res) => {
  try {
    uploadP(req, res, async (err) => {
      let file = req.file
      let data = req.body

      let checkDealer = await dealerService.getSingleDealerById({ _id: req.body.dealerId }, { isDeleted: false })
      // Your array of objects
      if (checkDealer.length == 0) {
        res.send({
          code: constant.errorCode,
          message: "Dealer Not found"
        })
        return;
      }

      if (!req.file) {
        res.send({
          code: constant.errorCode,
          message: "No file uploaded"
        })
        return;
      }

      let csvName = req.file.filename

      // from here copy
      const csvWriter = createCsvWriter({
        path: './uploads/resultFile/' + csvName,
        header: [
          { id: 'priceBook', title: 'Price Book' },
          { id: 'status', title: 'Status' },
          { id: 'reason', title: 'Reason' },
          // Add more headers as needed
        ],
      });
      const wb = XLSX.readFile(req.file.path);
      const sheets = wb.SheetNames;
      const ws = wb.Sheets[sheets[0]];
      const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);

      const headers = [];
      for (let cell in ws) {
        // Check if the cell is in the first row and has a non-empty value
        if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
          headers.push(ws[cell].v);
        }
      }

      if (headers.length !== 2) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file format detected. The sheet should contain exactly two columns."
        })
        return
      }

      const totalDataComing = totalDataComing1.map(item => {
        const keys = Object.keys(item);
        return {
          priceBook: item[keys[0]],
          retailPrice: item[keys[1]]
        };
      });
      //  return;
      // copy to here
      if (totalDataComing.length > 0) {
        const repeatedMap = {};
        for (let i = totalDataComing.length - 1; i >= 0; i--) {
          if (repeatedMap[totalDataComing[i].priceBook]) {
            totalDataComing[i].status = "not unique";
          } else {
            repeatedMap[totalDataComing[i].priceBook] = true;
            totalDataComing[i].status = null;
          }
        }

        const pricebookArrayPromise = totalDataComing.map(item => {
          if (!item.status) return priceBookService.findByName1({ name: item.priceBook ? item.priceBook : '', status: true });
          return null;
        })
    
        const pricebooksArray = await Promise.all(pricebookArrayPromise);
  
        for (let i = 0; i < totalDataComing.length; i++) {
          if (!pricebooksArray[i]) {
            if (totalDataComing[i].status != "not unique") totalDataComing[i].status = "price catalog does not exist";
            totalDataComing[i].priceBookDetail = null
          } else {
            totalDataComing[i].priceBookDetail = pricebooksArray[i];
          }
        }
        console.log("totalDataComing1",totalDataComing);
        const dealerArrayPromise = totalDataComing.map(item => {

          if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(data.dealerId), priceBook: item.priceBookDetail._id }, {});
          return false;
        })
      //  console.log(dealerArrayPromise);return;
        const dealerArray = await Promise.all(dealerArrayPromise);
        console.log("totalDataComing2",totalDataComing);
        console.log("dealerArray",dealerArray);
        for (let i = 0; i < totalDataComing.length; i++) {
          if (totalDataComing[i].priceBookDetail) {
            if (dealerArray[i]) {
              dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
              dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
              await dealerArray[i].save();
              if (totalDataComing[i].retailPrice == undefined) {
                totalDataComing[i].status = "Dealer catalog retail price is empty";
              } else {
                totalDataComing[i].status = "Dealer catalog updated successully";
              }
            } else {
              const count = await dealerPriceService.getDealerPriceCount();
              let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
              let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;
              dealerPriceService.createDealerPrice({
                dealerId: data.dealerId,
                priceBook: totalDataComing[i].priceBookDetail._id,
                unique_key: unique_key,
                status: true,
                retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                wholesalePrice
              })
              totalDataComing[i].status = "Dealer catalog created successully";
            }
          }
        }

        console.log("totalDataComing3",totalDataComing);
        const csvArray = totalDataComing.map((item) => {
          return {
            priceBook: item.priceBook ? item.priceBook : "",
            retailPrice: item.retailPrice ? item.retailPrice : "",
            status: item.status
          }
        })

        function countStatus(array, status) {
          return array.filter(item => item.status === status).length;
        }

        const countNotExist = countStatus(csvArray, "price catalog does not exist");
        const countNotUnique = countStatus(csvArray, "not unique");
        const totalCount = csvArray.length

        function convertArrayToHTMLTable(array) {
          const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
          const rows = array.map(obj => {
            const values = Object.values(obj).map(value => `<td>${value}</td>`);
            values[2] = `${values[2]}`;
            return values.join('');
          });

          const htmlContent = `<html>
              <head>
                  <style>
                      table {
                          border-collapse: collapse;
                          width: 100%;
                      }
                      th, td {
                          border: 1px solid #dddddd;
                          text-align: left;
                          padding: 8px;
                      }
                      th {
                          background-color: #f2f2f2;
                      }
                  </style>
              </head>
              <body>
                  <table>
                      <thead><tr>${header}</tr></thead>
                      <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                  </table>
              </body>
          </html>`;

          return htmlContent;
        }

        const htmlTableString = convertArrayToHTMLTable(csvArray);
        const mailing = sgMail.send(emailConstant.sendCsvFile('amit@codenomad.net', htmlTableString));
      }
      
      res.send({
        code: constant.successCode,
        message: "Added successfully"
      })

    })
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
    let checkDealer = await dealerService.getDealerByName({ _id: req.params.dealerId })
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }

    const trueArray = [];
    const falseArray = [];

    data.servicers.forEach(item => {
      if (item.status || item.status == "true") {
        trueArray.push(item);
      } else {
        falseArray.push(item);
      }
    });



    let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
    let checkId = trueArray.map(record => record._id)
    const existingRecords = await dealerRelationService.getDealerRelations({
      dealerId: new mongoose.Types.ObjectId(req.params.dealerId),
      servicerId: { $in: checkId }
    });

    // Step 2: Separate existing and non-existing servicer IDs
    const existingServicerIds = existingRecords.map(record => record.servicerId.toString());

    const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));

    console.log(existingRecords,existingServicerIds,checkId,newServicerIds)
    // Step 3: Delete existing records
    let deleteData = await dealerRelationService.deleteRelations({
      dealerId: new mongoose.Types.ObjectId(req.params.dealerId),
      servicerId: { $in: uncheckId }
    });
    // return res.json(deleteData)
    // Step 4: Insert new records
    const newRecords = newServicerIds.map(servicerId => ({
      dealerId: req.params.dealerId,
      servicerId: servicerId
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
    //     console.log('new------------')

    //   } else {
    //     console.log('delete------------')

    //   }
    // }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerServicers = async (req, res) => {
  try {
    let data = req.body
    let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })
    if (!getServicersIds) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the servicer"
      })
      return;
    }
    let ids = getServicersIds.map((item) => item.servicerId)
    let servicer = await providerService.getAllServiceProvider({ _id: { $in: ids } }, {})
    if (!servicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the servicers"
      })
      return;
    }
    const servicerIds = servicer.map(obj => obj._id);
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getServicerUser(query1, {})
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
}

exports.unAssignServicer = async (req, res) => {
  try {
    let data = req.body
    let deleteRelation = await dealerRelation.findOneAndDelete({ servicerId: data.servicerId, dealerId: data.dealerId })
    if (!deleteRelation) {
      res.send({
        code: constant.errorCode,
        message: "Unable to unassign"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Unassigned successfully", deleteRelation
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getServicersList = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false, accountStatus: "Approved", status: true }
    let projection = { __v: 0, isDeleted: 0 }
    let servicer = await providerService.getAllServiceProvider(query, projection);


    let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })

    const resultArray = servicer.map(item => {
      const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
      const documentData = item._doc;
      return { ...documentData, check: !!matchingServicer };
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

exports.filterDealer = async (req, res) => {
  try {
    let data = req.body

    console.log(data)

    let response = await dealerService.getAllDealers1(data)

    res.send({
      code: constant.successCode,
      message: "Success",
      result: response
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}



































//-------------------------------------under developement section ----------------------------//

const MongoClient = require('mongodb').MongoClient;

// Connection URLs for the two databases
const url2 = `${process.env.DB_URL}User`;
const url1 = `${process.env.DB_URL}Dealer`;

// Common ID

// Create MongoClient instances for each database
const client2 = new MongoClient(url2, { useNewUrlParser: true, useUnifiedTopology: true });
const client1 = new MongoClient(url1, { useNewUrlParser: true, useUnifiedTopology: true });

// Connect to the servers
// Promise.all([ client2.connect()])
// .then(() => {
// console.log('Connected to both databases');

// // Specify the databases
// const db2 = client2.db();

// // Specify the collections
// const collection2 = db2.collection('dealers');




// // Close the connections
// client2.close();
// });
// })
// .catch(err => {
// console.error('Error connecting to databases:', err);
// });


exports.getDealerRequest = async (req, res) => {
  try {
    let data = req.body
    Promise.all([client1.connect(), client2.connect()])
      .then(async () => {
        console.log('Connected to both databases');

        // Specify the databases
        const db1 = client1.db();
        const db2 = client2.db();

        // Specify the collections
        const collection1 = db1.collection('dealers');
        const collection2 = db2.collection('users');
        console.log(collection2)

        // Perform a $lookup aggregation across databases
        console.log('Perform a $lookup aggregation across databases')
        let data1 = await dealer.aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId("6579815d97bf5c1bb11be1d9") } // Match documents with the common ID
          },
          {
            $lookup: {
              from: collection2.namespace,
              localField: '_id',
              foreignField: 'accountId', // Replace with the actual common field in collection2
              as: 'result'
            }
          }
        ])

        console.log('Result:__________-------------------------------------', data1);
        res.send({
          code: constant.errorCode,
          message: data1
        })
        // Close the connections
        client1.close();
        client2.close();
        // });
      })
      .catch(err => {
        console.error('Error connecting to databases:', err);
      });


  } catch (err) {
    console.log("Err in getDealerRequest : ", err);
  }
}     