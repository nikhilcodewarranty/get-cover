require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');

const userResourceResponse = require("../utils/constant");
const userService = require("../services/userService");
const dealerService = require('../../Dealer/services/dealerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");


//----------------------- api's function ---------------//

// get all users 
exports.getAllUsers = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };
    const checkRole = await role.findOne({ role: { '$regex': req.params.role, '$options': 'i' } });
    console.log('role+++++++++++++++++++++++++++++++++=',checkRole)
    let query = {roleId:new mongoose.Types.ObjectId(checkRole?checkRole._id:'000000000000000000000000'),isDeleted:false}
    console.log(query)
    let projection = {isDeleted:0,__v:0}
    const users = await userService.getAllUsers(query,projection);
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        users: users
      }
    })
  } catch (error) {
    res
      .status(constant.errorCode)
      .json({ error: "Internal server error" });
  }
};

// create user 
exports.createUser = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };
    const createdUser = await userService.createUser(req.body);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  };
};

//get user detail with ID
exports.getUserById = async (req, res) => {
  try {
    let projection = { __v: 0, status: 0 }
    let userId = req.params.userId?req.params.userId:'000000000000000000000000'
    const singleUser = await userService.getUserById(userId, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser
    })
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

// update user details with ID
exports.updateUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
    let option = { new: true };
    const updateUser = await userService.updateUser(criteria, req.body, option);
    if (!updateUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//delete user api
exports.deleteUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true }
    const deleteUser = await userService.deleteUser(criteria, newValue, option);
    if (!deleteUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// create super admin credentials
exports.createSuperAdmin = async (req, res) => {
  try {
    let data = req.body
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email already exist"
      })
      return;
    }

    // Check if the provided role is 'super'
    const superRole = await role.findOne({ role: "Super Admin" });
    if (!superRole) {
      res.send({
        code: constant.errorCode,
        message: "Role not found"
      })
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    let userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: data.accountId,
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, //Assign super role
      isPrimary: data.isPrimary,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = await userService.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //success response 
    res.send({
      code: constant.successCode,
      message: "Account created successfully",
      data:savedUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    });
  }
};

//---------------------------create a new dealer from SA 
exports.createDealer = async (req, res) => {
  try {
    const data = req.body;

    // Check if the user has Super Admin role
    if (req.role !== "Super Admin") {
       res.status(403).json({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return;
    }

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
       res.status(400).json({
        code: constant.errorCode,
        message: "Invalid role"
      });
      return;
    }

    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: data.name }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
       res.status(400).json({
        code: constant.errorCode,
        message: 'Dealer name already exists',
      });
      return;
    }

    let accountCreationFlag = req.body.customerAccountCreated;

    // Primary Account Creation with status false
    if (!req.body.isAccountCreate) {
      const dealerPrimaryUserArray = data.dealerPrimary;
      const primaryEmailValues = dealerPrimaryUserArray.map(value => value.email);

      const primaryUserData = await userService.findByEmail(primaryEmailValues);
      if (primaryUserData.length > 0) {
         res.status(400).json({
          code: constant.errorCode,
          message: 'Email Already Exists',
          data: primaryUserData
        });
        return;
      }

      const resultPrimaryDealerData = await Promise.all(dealerPrimaryUserArray.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }));

      const createUsers = await userService.insertManyUser(resultPrimaryDealerData);
      if (!createUsers) {
         res.status(500).json({
          code: constant.errorCode,
          message: "Unable to save users"
        });
        return;
      }
      accountCreationFlag = false;
    }

    // Create Dealer Meta Data
    const dealerMeta = {
      name: data.name,
      street: data.street,
      userAccount: req.body.customerAccountCreated,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy
    };

    // Create Dealer
    const createMetaData = await dealerService.createDealer(dealerMeta);
    if (!createMetaData) {
       res.status(500).json({
        code: constant.errorCode,
        message: "Something went wrong"
      });
      return;
    }

    // If account Creation is true
    if (accountCreationFlag) {
      const dealerUserArray = data.dealers;
      const emailValues = dealerUserArray.map(value => value.email);

      const userData = await userService.findByEmail(emailValues);
      if (userData.length > 0) {
         res.status(400).json({
          code: constant.errorCode,
          message: 'Email Already Exists',
          data: userData
        });
        return;
      }

      const resultDealerData = await Promise.all(dealerUserArray.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }));

      const createUsers = await userService.insertManyUser(resultDealerData);
      if (!createUsers) {
         res.status(500).json({
          code: constant.errorCode,
          message: "Unable to save users"
        });
        return;
      }

      // Dealer Price Book Data
      const dealerPriceArray = data.priceBook;
      const resultPriceData = dealerPriceArray.map(obj => ({
        'priceBook': obj.priceBook,
        'dealerId': createMetaData._id,
        'brokerFee': obj.brokerFee,
        'retailPrice': obj.retailPrice
      }));

      const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
      if (!createPriceBook) {
         res.status(500).json({
          code: constant.errorCode,
          message: "Unable to save price book"
        });
        return;
      }
    }

     res.status(201).json({
      code: constant.successCode,
      message: 'Successfully Created',
      data: createMetaData
    });
    return;
  } catch (err) {
    return res.status(500).json({
      code: constant.errorCode,
      message: err.message
    });
  }
};


//Create new service provider By SA
exports.createServiceProvider = async (req, res) => {
  try {
    const data = req.body;
    const providerUserArray = data.providers;
    // Find data by email
    const emailValues = providerUserArray.map(value => value.email);

    const userData = await userService.findByEmail(emailValues);

    if (userData) {
      return res.send({
        code: constant.errorCode,
        message: 'Email Already Exists',
        data: userData
      });
    }

    // Hash the password
    //const hashedPassword = await bcrypt.hash(data.password, 10);

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: 'Invalid role',
      });
    }

    // Create a new provider meta data
    const providerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      userAccount: req.body.customerAccountCreated,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy,
    };

    // Create the service provider
    const createMetaData = await providerService.createServiceProvider(providerMeta);
    if (!createMetaData) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create servicer account',
      });
    }

    // Remove duplicates
    const resultProvider = providerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
    const resultProviderData = accountCreationFlag
      ? await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }))
      : await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, password: hashedPassword };
      }));

    // Map provider data


    // Create provider users
    const createProviderUsers = await userService.insertManyUser(resultProviderData);
    if (!createProviderUsers) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create users',
      });
    }

    return res.send({
      code: constant.successCode,
      message: 'Successfully Created',
    });

  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
      data:createMetaData
    });
  }
};

// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email });
    if (!user) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    if(user.status==false){
      res.send({
        code:constant.errorCode,
        message:"Account is not approved"
      })
      return;
    }
    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    let roleQuery = { _id: user.roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: getRole.role },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "356d" }
    );

    res.send({
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// get all roles
exports.getAllRoles = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const roles = await userService.getAllRoles(query, projection);
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the roles "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        roles: roles
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// get all roles
exports.getAllTerms = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const terms = await userService.getAllTerms(query, projection);
    if (!terms) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the terms "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        terms: terms
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// add new roles
exports.addRole = async (req, res) => {
  try {
    const createdUser = await userService.addRole(req.body);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the role"
      })
    }
    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data:createdUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// add new terms

exports.createTerms = async (req, res) => {
  try {
    const monthTerms = generateMonthTerms(10); // You can specify the number of months as needed

    console.log(monthTerms);

    const createdTerms = await userService.createTerms(monthTerms);

    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data: createdTerms
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the terms"
    });
  }
};

const generateMonthTerms = (numberOfTerms) => {
  const monthTerms = [];

  for (let i = 1; i <= numberOfTerms; i++) {
    const months = i * 12;
    const monthObject = {
      terms: `${months} Month`,
      status: true
    };

    monthTerms.push(monthObject);
  }

  return monthTerms;
};

exports.sendLinkToEmail = async (req, res) => {
  try {
    let data = req.body
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (!checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "Invalid email"
      })
    } else {
      const mailing = sgMail.send(emailConstant.msg(checkEmail._id, resetPasswordCode, checkEmail.email))
      if (mailing) {
        let updateStatus = await userService.updateUser({ _id: checkEmail._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
        res.send({
          code: constant.successCode,
          message: "Email has been sent",
          codes:resetPasswordCode
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

exports.resetPassword = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId })
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Invalid link"
      })
      return;
    };
    if (checkUser.resetPasswordCode != req.params.code) {
      res.send({
        code: constant.errorCode,
        message: "Link has been expired"
      })
      return;
    };
    let hash = await bcrypt.hashSync(data.password, 10);
    let newValues = {
      $set: {
        password: hash,
        resetPasswordCode: null,
        isResetPassword: false
      }
    }
    let option = { new: true }
    let criteria = { _id: checkUser._id }
    let updatePassword = await userService.updateUser(criteria, newValues, option)
    if (updatePassword) {
      res.send({
        code: constant.successCode,
        message: "Password updated successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}