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
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");


//----------------------- api's function ---------------//

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
    const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
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
      data: createMetaData
    });
  }
};

// add new terms /// only for backend use
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

//generate monthly terms /// only for backend use
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

// create dealer by super admin

exports.createDealer = async (req, res) => {
  try {
    const data = req.body;

    // Check if the user has Super Admin role
    if (req.role !== "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return
    }

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      });
      return;
    }

    //If flag is approved

    if (data.flag == 'approved') {
      const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
      if (!singleDealer) {
        res.send({
          code: constant.errorCode,
          message: "Dealer Not found"
        });
        return;
      }
      const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
      let priceBook = [];
      let checkPriceBook = [];
      let dealerPriceArray = data.priceBook ? data.priceBook : [];
      const dealersUserData = data.dealers ? data.dealers : [];
      const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);

      const allUserData = [...dealersUserData, ...primaryUserData];
      const uniqueEmails = new Set(allEmails);
      if (allEmails.length !== uniqueEmails.size) {
        res.send({
          code: constant.errorCode,
          message: 'Multiple user cannot have same emails',
        });
        return
      }

      const emailData = await userService.findByEmail(allEmails);
      if (emailData.length > 0) {
        res.send({
          code: constant.errorCode,
          message: 'Email Already Exist',
          data: emailData
        });
        return;
      }
      let savePriceBookType = req.body.savePriceBookType
      if (savePriceBookType == 'manually') {
        //check price book  exist or not
        priceBook = dealerPriceArray.map((dealer) => dealer.priceBook);
        const priceBookCreateria = { _id: { $in: priceBook } }
        checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
        if (checkPriceBook.length == 0) {
          res.send({
            code: constant.errorCode,
            message: "Product does not exist.Please check the product"
          })
          return;
        }
        const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
        if (missingProductNames.length > 0) {
          res.send({
            code: constant.errorCode,
            message: 'Some products is not created. Please check the product',
            missingProductNames: missingProductNames
          });
          return;
        }

        // check product is already for this dealer

        if (priceBook.length > 0) {
          let query = {
            $and: [
              { 'priceBook': { $in: priceBook } },
              { 'dealerId': data.dealerId }
            ]
          }

          const existingData = await dealerPriceService.findByIds(query);
          if (existingData.length > 0) {
            res.send({
              code: constant.errorCode,
              message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
            });
            return;
          }

        }

        //save Price Books for this dealer
        const resultPriceData = dealerPriceArray.map(obj => ({
          'priceBook': obj.priceBook,
          'dealerId': data.dealerId,
          'brokerFee': Number(obj.retailPrice) - Number(obj.wholePrice),
          'retailPrice': obj.retailPrice
        }));

        const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
        if (!createPriceBook) {
          res.send({
            code: constant.errorCode,
            message: "Unable to save price book"
          });
          return;
        }

        const allUsersData = allUserData.map((obj,index) => ({
          ...obj,
          roleId: checkRole._id,
          accountId: data.dealerId,
          isPrimary: index === 0 ? true :false ,
          status: req.body.isAccountCreate ? obj.status : false
        }));

        const createUsers = await userService.insertManyUser(allUsersData);

        if (!createUsers) {
          res.send({
            code: constant.errorCode,
            message: "Unable to save users"
          });
          return;
        }

        let dealerQuery = { _id: data.dealerId }
        let newValues = {
          $set: {
            status: "Approved",
          }
        }
        let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
        if (!dealerStatus) {
          res.send({
            code: constant.errorCode,
            message: "Unable to approve dealer status"
          });
          return;
        }

        let resetPasswordCode = randtoken.generate(4, '123456789')
        const mailing = await sgMail.send(emailConstant.msg(singleDealer._id, resetPasswordCode, singleDealer.email))

        if (mailing) {
          let updateStatus = await userService.updateUser({ _id: singleDealer._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
          res.send({
            code: constant.successCode,
            message: "Email has been sent",
            codes: resetPasswordCode
          })
        }
      }
      res.send({
        code: constant.successCode,
        message: "Status Approved"
      });

      return;
    }

    else {
      // Check if the dealer already exists
      const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
      if (existingDealer) {
        res.send({
          code: constant.errorCode,
          message: 'Dealer name already exists',
        });
        return
      }
      //check request body contains duplicate emails
      const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
      let priceBook = [];
      let checkPriceBook = [];
      const dealerPriceArray = data.priceBook ? data.priceBook : [];
      const dealersUserData = data.dealers ? data.dealers : [];
      const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);

      const allUserData = [...dealersUserData, ...primaryUserData];
      const uniqueEmails = new Set(allEmails);

      if (allEmails.length !== uniqueEmails.size) {
        res.send({
          code: constant.errorCode,
          message: 'Multiple user cannot have same emails',
        });
        return
      }
      // Check email exist
      // const emailValues = primaryUserData.map(value => value.email);
      const emailData = await userService.findByEmail(allEmails);
      if (emailData.length > 0) {
        res.send({
          code: constant.errorCode,
          message: 'Email Already Exist',
          data: emailData
        });
        return;
      }
      // check Price Book upload manually or by bulk upload
      let savePriceBookType = req.body.savePriceBookType
      if (savePriceBookType == 'manually') {
        //check price book  exist or not
        priceBook = dealerPriceArray.map((dealer) => dealer.priceBook);
        const priceBookCreateria = { _id: { $in: priceBook } }
        checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
        if (checkPriceBook.length == 0) {
          res.send({
            code: constant.errorCode,
            message: "Product does not exist.Please check the product"
          })
          return;
        }
        const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
        if (missingProductNames.length > 0) {
          res.send({
            code: constant.errorCode,
            message: 'Some products is not created. Please check the product',
            missingProductNames: missingProductNames
          });
          return;
        }
        // check product is already for this dealer
      }

      // return false;
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
        res.send({
          code: constant.errorCode,
          message: "Unable to create dealer"
        });
        return;
      }
      // Create User for primary dealer
      const allUsersData = allUserData.map((obj, index) => ({
        ...obj,
        roleId: checkRole._id,
        accountId: createMetaData._id,
        isPrimary: index === 0 ? true :false ,
        status: req.body.isAccountCreate ? obj.status : false
      }));

      const createUsers = await userService.insertManyUser(allUsersData);

      if (!createUsers) {
        res.send({
          code: constant.errorCode,
          message: "Unable to save users"
        });
        return;
      }


      //save Price Books for this dealer
      const resultPriceData = dealerPriceArray.map(obj => ({
        'priceBook': obj.priceBook,
        'dealerId': createMetaData._id,
        'brokerFee': Number(obj.retailPrice) - Number(obj.wholePrice),
        'retailPrice': obj.retailPrice
      }));

      const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
      if (!createPriceBook) {
        res.send({
          code: constant.errorCode,
          message: "Unable to save price book"
        });
        return;
      }

      //Approve status 

      res.send({
        code: constant.successCode,
        message: 'Successfully Created',
        data: createMetaData
      });
    }



  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};



//save Dealer Meta Data




//---------------------------------------------------- refined code ----------------------------------------//

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
    if (user.status == false) {
      res.send({
        code: constant.errorCode,
        message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
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
      data: savedUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    });
  }
};

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
    let query = { roleId: new mongoose.Types.ObjectId(checkRole ? checkRole._id : '000000000000000000000000'), isDeleted: false }
    console.log(query)
    let projection = { isDeleted: 0, __v: 0 }
    const users = await userService.getAllUsers(query, projection);
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

//get user detail with ID
exports.getUserById = async (req, res) => {
  try {
    let projection = { __v: 0, status: 0 }
    let userId = req.params.userId ? req.params.userId : '000000000000000000000000'
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
    res.send({
      code: constant.errorCode,
      message: err.message
    })
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
    let checkRole = await userService.getRoleById({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } })
    if (checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Role already exist"
      })
      return;
    }
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
      data: createdUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

//send reset password link to email
exports.sendLinkToEmail = async (req, res) => {
  try {
    let data = req.body
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (!checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User does not exist"
      })
    } else {
      if (checkEmail.status == false || isDeleted == true) {
        res.send({
          code: constant.errorCode,
          message: "This account is currently awaiting approval from the administrator"
        })
        return;
      }
      const mailing = await sgMail.send(emailConstant.msg(checkEmail._id, resetPasswordCode, checkEmail.email))

      if (mailing) {
        let updateStatus = await userService.updateUser({ _id: checkEmail._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
        res.send({
          code: constant.successCode,
          message: "Email has been sent",
          codes: resetPasswordCode
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

//reset password with link
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

// get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    let dealerQuery = { isDeleted: false,title:'New Dealer Registration'}
    let servicerQuery = { isDeleted: false,title:'New Servicer Registration'}
    let projection = { __v: 0 }
    const dealerNotification = await userService.getAllNotifications(dealerQuery, projection);
    const servicerNotification = await userService.getAllNotifications(servicerQuery, projection);
    const mergedNotifications = [...dealerNotification, ...servicerNotification];
    let criteria = { status: false };
    let newValue = {
      $set: {
        status: true
      }
    };



    //Update Notification
    const updateNotification = await userService.updateNotification(criteria, newValue, { new: true });
    if (!updateNotification) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the notifications "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        notification: mergedNotifications
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};
exports.checkEmail = async (req, res) => {
  try {
    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: { '$regex': new RegExp(`^${req.body.email}$`, 'i') } });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email is already exist!"
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success"
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};



