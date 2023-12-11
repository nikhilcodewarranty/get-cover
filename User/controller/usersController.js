require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const randtoken = require('rand-token').generator()
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
    const users = await userService.getAllUsers();
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
    const savedUser = userService.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //success response 
    res.send({
      code: constant.successCode,
      message: "Account created successfully"
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

    // Check if the role exists
    const checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: "Invalid role"
      });
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
      return res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      });
    }

    let accountCreationFlag = req.body.customerAccountCreated;

    // Primary Account Creation with status false
    if (!req.body.isAccountCreate) {
      const dealerPrimaryUserArray = data.dealerPrimary;
      const primaryEmailValues = dealerPrimaryUserArray.map(value => value.email);
      const primaryUserData = await userService.findByEmail(primaryEmailValues);
      if (primaryUserData) {
        return res.send({
          code: constant.errorCode,
          message: 'Email Already Exists',
          data: userData
        });
      }
      const resultPrimaryDealer = primaryUserData.filter(obj => !primaryUserData.some(excludeObj => obj.email === excludeObj.email));
      const resultPrimaryDealerData = await Promise.all(resultPrimaryDealer.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }));

      const createUsers = await userService.insertManyUser(resultPrimaryDealerData);
      if (!createUsers) {
        return res.send({
          code: constant.errorCode,
          message: "Unable to save users"
        });
      }

      accountCreationFlag = false;
    }

    // If account Creation is true
    if (accountCreationFlag) {
      const dealerUserArray = data.dealers;
      const emailValues = dealerUserArray.map(value => value.email);
      const userData = await userService.findByEmail(emailValues);

      if (userData.length > 0) {
        return res.send({
          code: constant.errorCode,
          message: 'Email Already Exists',
          data: userData
        });
      }

      const resultDealer = dealerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
      const resultDealerData = await Promise.all(resultDealer.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }));

      const createUsers = await userService.insertManyUser(resultDealerData);
      if (!createUsers) {
        return res.send({
          code: constant.errorCode,
          message: "Unable to save users"
        });
      }

      // Dealer Price Book Data
      const dealerPriceArray = data.priceBook;
      const resultPriceData = dealerPriceArray.map(obj => ({
        'priceBook': obj.priceBook,
        'dealerId': createMetaData._id,
        'brokerFee': obj.brokerFee
      }));

      const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
      if (!createPriceBook) {
        return res.send({
          code: constant.errorCode,
          message: "Unable to save price book"
        });
      }
    }

    return res.send({
      code: constant.successCode,
      message: 'Successfully Created',
    });
  } catch (err) {
    return res.send({
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
      { expiresIn: "1h" }
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
    res.json(createdUser);
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
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
      const mailing = sgMail.send(emailConstant.msg(checkEmail._id, resetPasswordCode, "anil@codenomad.net"))
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