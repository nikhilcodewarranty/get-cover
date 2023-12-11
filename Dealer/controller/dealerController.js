const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");

// get all dealers 
exports.getAllDealers = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false }
    let projection = { __v: 0, isDeleted: 0 }
    const dealers = await dealerService.getAllDealers(query, projection);
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: dealers
    })
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
    let data = req.body
    let getUser = await USER.findOne({ _id: req.userId })
    if (!getUser) {
      res.send({
        code: constant.errorCode,
        message: "Invalid token ID"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: getUser.accountId });
    let result = getUser.toObject()
    result.metaData = singleDealer
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: result
      })
    };
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

    console.log(data);
    
    // Extracting necessary data for dealer creation
    const dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
    };

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: 'Invalid role',
      });
    }

    // Register the dealer
    const createMetaData = await dealerService.registerDealer(dealerMeta);
    if (!createMetaData) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create dealer account',
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
    // const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      // password: hashedPassword,
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

exports.statusUpdate = async (req, res) => {
  if (req.role != "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only super admin allow to do this action"
    })
    return;
  }
  let data = req.body;
    let criteria = { _id: req.params.dealerPriceBook };
    let newValue = {
      $set: {
        status:req.body.status
      }
    };
    let option = { new: true };
   try {
    const updatedResult = await dealerService.statusUpdate(criteria, newValue, option)
    if (!updatedResult) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer price status"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully"
    })
    }
    catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
    });
  }
};


