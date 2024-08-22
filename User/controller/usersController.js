require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const userService = require("../services/userService");
const dealerService = require('../../Dealer/services/dealerService')
const resellerService = require('../../Dealer/services/resellerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const multer = require('multer');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const logs = require('../../User/model/logs');
const customerService = require("../../Customer/services/customerService");
const supportingFunction = require('../../config/supportingFunction')
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');

// s3 bucket connections
const s3 = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  }
});

const Storage = multerS3({
  s3: s3,
  bucket: process.env.bucket_name, // Ensure this environment variable is set
  metadata: (req, files, cb) => {
    cb(null, { fieldName: files.fieldname });
  },
  key: (req, files, cb) => {
    const fileName = files.fieldname + '-' + Date.now() + path.extname(files.originalname);
    cb(null, fileName);
  }
});

var upload = multer({
  storage: Storage,
}).any([
  { name: "file" },
  { name: "termCondition" },
])

// add new terms /// only for backend use
exports.createTerms = async (req, res) => {
  try {
    const monthTerms = generateMonthTerms(10); // You can specify the number of months as needed
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
      terms: `${months}`,
      status: true
    };

    monthTerms.push(monthObject);
  }

  return monthTerms;
};

// validate dealer by super admin
exports.validateData = async (req, res) => {
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

  let priceBook = [];
  const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
  const dealersUserData = data.dealers ? data.dealers : [];
  const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
  let checkPriceBook = [];

  let dealerPriceArray = data.priceBook ? data.priceBook : [];
  const uniqueEmails = new Set(allEmails);


  if (allEmails.length !== uniqueEmails.size) {
    res.send({
      code: constant.errorCode,
      message: 'Multiple user cannot have same emails',
    });
    return
  }

  let savePriceBookType = req.body.savePriceBookType

  if (savePriceBookType == 'yes') {
    //check price book  exist or not
    priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
    const priceBookCreateria = { _id: { $in: priceBook } }
    checkPriceBook = await priceBookService.getMultiplePriceBook(priceBookCreateria, { isDeleted: false })
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

  }
  if (data.dealerId != 'null' && data.dealerId != undefined) {
    const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      });
      return;
    }

    //check new name is not exist in the database
    const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
    const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

    if (cleanStr1 !== cleanStr2) {
      const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
      if (existingDealer) {
        res.send({
          code: constant.errorCode,
          message: 'Dealer name already exists',
        });
        return
      }
    }

    //check product is already exist for dealer this
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
  }
  res.send({
    code: constant.successCode,
    message: 'Success',
  });
}

// Login User 
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email.toLowerCase() }, {});
    if (!user) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    let roleQuery = { _id: user.roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    if (getRole.role == "Dealer") {
      let checkDealer = await dealerService.getDealerById(user.metaId)
      if (!checkDealer?.accountStatus) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Reseller") {
      let checkReseller = await resellerService.getReseller({ _id: user.metaId })
      if (!checkReseller?.status) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Servicer") {
      let checkServicer = await providerService.getServiceProviderById({ _id: user.metaId })
      if (!checkServicer?.status) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (user.status == false) {
      res.send({
        code: constant.errorCode,
        message: "Your account is not active, please contact to the administration"
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.metaId ? user.metaId : user._id, teammateId: user._id, email: user.email, role: getRole.role, status: user.status },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "1d" }
    );

    res.send({
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email,
        userInfo: {
          firstName: user.firstName,
          lastName: user.lastName
        },
        role: getRole.role
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
    const existingUser = await userService.findOneUser({ email: data.email }, {});
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
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, //Assign super role
      isPrimary: true,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = await userService.createUser(userData);

    let updateUser = {
      metaId: savedUser._id,
    }

    const updateData = await userService.updateSingleUser({ _id: savedUser._id }, updateUser, { new: true })

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
      data: updateData
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
    let projection = { __v: 0 }
    let userId = req.params.userId ? req.params.userId : '000000000000000000000000'
    const singleUser = await userService.findOneUser({ _id: userId, }, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };

    let mainStatus;
    let criteria = { _id: singleUser.metaId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.status : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser,
      mainStatus: mainStatus
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
    let criteria = { _id: req.teammateId };
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

//Update User new
exports.updateUserData = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.userId ? req.params.userId : req.teammateId };
    let option = { new: true };
    const updateUser = await userService.updateSingleUser(criteria, data, option);

    if (!updateUser) {
      //Save Logs updateUserData
      let logData = {
        endpoint: "user/updateUserData",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the user data"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };

    //Get role by id
    const checkRole = await userService.getRoleById({ _id: updateUser.roleId }, {});

    //send notification to dealer when status change
    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({ metaId: updateUser.metaId, isPrimary: true })

    IDs.push(getPrimary._id)
    let notificationData = {
      title: checkRole.role + " " + "user change",
      description: "The  user has been changed!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: [getPrimary._id]
    };

    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    notificationEmails.push(getPrimary.email);
    notificationEmails.push(updateUser.email);
    let emailData;

    if (data.firstName) {
      emailData = {
        senderName: updateUser.firstName,
        content: "The user information has been updated successfully!.",
        subject: "Update User Info"
      }
    }

    else {
      const status_content = req.body.status ? 'Active' : 'Inactive';
      emailData = {
        senderName: updateUser.firstName,
        content: "Status has been changed to " + status_content + " " + ", effective immediately.",
        subject: "Update Status"
      }
    }

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(updateUser.email, getPrimary.email, emailData))

    //Save Logs updateUserData
    let logData = {
      endpoint: "user/updateUserData",
      userId: req.userId,
      body: data,
      response: {
        code: constant.successCode,
        message: "Updated Successfully",
        result: updateUser
      }
    }

    await logs(logData).save()

    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result: updateUser
    });
  } catch (err) {
    //Save Logs updateUserData
    let logData = {
      endpoint: "user/updateUserData catch",
      userId: req.userId,
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// get all terms 
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

// add new roles // backend use
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
    let checkEmail = await userService.findOneUser({ email: data.email.toLowerCase() }, {})
    if (!checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User does not exist"
      })
    } else {
      if (checkEmail.status == false || checkEmail.isDeleted == true) {
        res.send({
          code: constant.errorCode,
          message: "This account is currently awaiting approval from the administrator"
        })
        return;
      }
      let resetLink = `${process.env.SITE_URL}newPassword/${checkEmail._id}/${resetPasswordCode}`

      let data = {
        link: resetLink,
        name: checkEmail.firstName
      }
      const mailing = sgMail.send(emailConstant.resetpassword(checkEmail._id, resetPasswordCode, checkEmail.email, data))

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
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
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
        isResetPassword: false,
        approvedStatus: 'Approved',
        status: true
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
    const checkUser = await userService.getUserById1({ _id: req.params.userId }, {});
    const deleteUser = await userService.deleteUser(criteria, newValue, option);

    if (!deleteUser) {
      //Save Logs delete user
      let logData = {
        endpoint: "user/deleteUser",
        userId: req.userId,
        body: criteria,
        response: {
          code: constant.errorCode,
          message: "Unable to delete the user"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the user"
      });
      return;
    };
    const checkRole = await userService.getRoleById({ _id: checkUser.roleId }, {});

    let primaryUser = await supportingFunction.getPrimaryUser({ metaId: checkUser.metaId, isPrimary: true })

    //send notification to dealer when deleted
    let IDs = await supportingFunction.getUserIds()
    let notificationData = {
      title: "User Deletion",
      description: checkUser.firstName + " user has been deleted!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: [primaryUser._id]
    };

    let createNotification = await userService.createNotification(notificationData);

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    notificationEmails.push(primaryUser.email);
    notificationEmails.push(checkUser.email);

    let emailData = {
      senderName: checkUser.firstName,
      content: "Your account has been deleted by Get-Cover team.",
      subject: "Delete User"
    }

    let notificationDataUpdate = primaryUser.notificationTo.filter(email => email != checkUser.email);
    let updateUser = await userService.updateSingleUser({ _id: primaryUser._id }, { notificationTo: notificationDataUpdate }, { new: true })

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(checkUser.email, primaryUser.email, emailData))
    //Save Logs delete user
    let logData = {
      endpoint: "user/deleteUser",
      userId: req.userId,
      body: criteria,
      response: {
        code: constant.successCode,
        message: "Deleted Successfully"
      }
    }


    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    //Save Logs delete user
    let logData = {
      endpoint: "user/deleteUser catch",
      userId: req.userId,
      body: { type: "catch" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
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

//Get Notification
exports.getAllNotifications1 = async (req, res) => {
  try {
    let data = req.body

    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let getNotifications = await userService.getAllNotifications({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, skipLimit, limitData)
    let updateNotification = await userService.updateNotification({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, { $addToSet: { openBy: new mongoose.Types.ObjectId(req.teammateId) } }, { new: true })

    let updatedNotifications = getNotifications.map(notification => {
      const isRead = notification.readBy.includes(new mongoose.Types.ObjectId(req.teammateId));
      const isOpen = notification.openBy.includes(new mongoose.Types.ObjectId(req.teammateId));
      return {
        ...notification._doc,
        isRead,
        isOpen
      };
    });

    if (data.readFlag || data.readFlag == false) {
      if (data.readFlag != "") {
        if (data.readFlag == "true" || data.readFlag == true || data.readFlag != "false") {
          updatedNotifications = updatedNotifications.filter(item => item.isRead === true)
        } else {

          updatedNotifications = updatedNotifications.filter(item => item.isRead === false)

        }
      }
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      result: updatedNotifications,
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

//Read Notification
exports.readNotification = async (req, res) => {
  try {
    let data = req.body
    let checkId = await userService.updateNotification({ _id: req.params.notificationId }, { $addToSet: { readBy: req.teammateId } }, { new: true })
    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid notification ID"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Read All Notification
exports.readAllNotification = async (req, res) => {
  try {
    let data = req.body
    let checkId = await userService.updateNotification({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, { $addToSet: { readBy: req.teammateId } }, { new: true })

    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid notification ID"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//email check validation functions
exports.checkEmail = async (req, res) => {
  try {
    // Check if the email already exists
    const existingUser = await userService.findOneUser({ 'email': req.body.email }, {});

    if (existingUser && existingUser.approvedStatus == 'Approved') {
      res.send({
        code: constant.errorCode,
        message: "Email is already exist!",

      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      status: 'Pending'
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

//Get Count of Notification
exports.getCountNotification = async (req, res) => {
  try {
    let checkId = new mongoose.Types.ObjectId(req.teammateId)
    const allNotification = await userService.getCountNotification({ notificationFor: checkId, openBy: { $ne: checkId } });

    res.send({
      code: constant.successCode,
      message: "Successful",
      count: allNotification
    });

    return;
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.checkEmailForSingle = async (req, res) => {
  try {
    let checkEmail = await userService.findOneUser({ email: req.body.email }, {})
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email ID"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Update Profile
exports.updateProfile = async (req, res) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action!'
      });
      return
    }
    const data = req.body
    let email = data.email
    let updateProfile = await userService.updateSingleUser({ email: email }, data, { new: true })

    if (!updateProfile) {
      res.send({
        code: constant.errorCode,
        message: 'Unabe to update profile!'
      })
      return
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateProfile
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// Update Password
exports.updatePassword = async (req, res) => {
  try {
    let data = req.body
    const id = req.teammateId
    let checkId = await userService.getSingleUserByEmail({ _id: id })

    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid user ID"
      })
      return;
    };

    let comparePassword = await bcrypt.compare(data.oldPassword, checkId.password)
    if (!comparePassword) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Old Password"
      })
      return
    };

    data.password = bcrypt.hashSync(data.newPassword, 10)
    let updatePassword = await userService.updateSingleUser({ _id: checkId._id }, data, { new: true })

    if (!updatePassword) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the password"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated the password",
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Get User by jwt token
exports.getUserByToken = async (req, res) => {
  try {
    let projection = { __v: 0 }
    let userId = req.userId
    const singleUser = await userService.findOneUser({ _id: userId, }, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };

    let mainStatus;
    let criteria = { _id: singleUser.metaId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.status : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser,
      mainStatus: mainStatus
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Add members
exports.addMembers = async (req, res) => {
  try {
    let data = req.body
    let checkEmail = await userService.getSingleUserByEmail({ email: data.email })
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exists with this email"
      })
      return;
    };
    data.isPrimary = false;
    let getRole = await userService.getRoleById({ role: req.role })
    data.metaId = req.userId
    data.roleId = getRole._id
    let saveData = await userService.createUser(data)

    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the member"
      })
      return;
    };

    let notificationEmails = await supportingFunction.getUserEmails();

    let IDs = await supportingFunction.getUserIds()

    let notificationData = {
      title: "New member created",
      description: "The new member " + data.firstName + " has been created",
      userId: req.teammateId,
      contentId: null,
      flag: 'Member Created',
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);

    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: data.email }, { resetPasswordCode: resetPasswordCode }, { new: true });
    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
    const resetPassword = sgMail.send(emailConstant.servicerApproval(data.email, { flag: "created", subject: "Set Password", link: resetLink, role: req.role == 'Super Admin' ? 'Admin' : req.role, servicerName: data.firstName }))
    // // Create the user
    res.send({
      code: constant.successCode,
      message: "Created Successfully"
    })

  } catch (err) {
    const lineNumber = err.stack.split('\n')[1].split(':')[1];
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Get Members
exports.getMembers = async (req, res) => {
  try {
    let data = req.body
    data.isPrimary = false;
    let userMembers = await userService.getMembers({
      $and: [
        { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        {
          $or: [
            { metaId: req.userId },
            { _id: req.userId },
          ]
        },

      ]
    }, { isDeleted: false })

    let userMember = await userService.getUserById1({ _id: req.teammateId }, { isDeleted: false })

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: userMembers ? userMembers : [],
      loginMember: userMember
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Get account information
exports.getAccountInfo = async (req, res) => {
  try {
    let accountInfo;
    if (req.role == 'Dealer') {
      accountInfo = await dealerService.getDealerById(req.userId, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1, userAccount: 1, isServicer: 1 })
    }
    if (req.role == 'Customer') {
      accountInfo = await customerService.getCustomerById({ _id: req.userId }, { username: 1, city: 1, state: 1, zip: 1, street: 1, country: 1 })
    }
    if (req.role == 'Reseller') {
      accountInfo = await resellerService.getReseller({ _id: req.userId }, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1, isServicer: 1 })
    }
    if (req.role == 'Servicer') {
      accountInfo = await providerService.getServiceProviderById({ _id: req.userId }, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1 })
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: accountInfo
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Change Primary User 
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

    let updateLastPrimary = await userService.updateSingleUser({ metaId: checkUser.metaId, isPrimary: true }, { isPrimary: false }, { new: true })
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
};

//Check token for user
exports.checkToken = async (req, res) => {
  try {
    let data = req.body
    let getUserDetails = await userService.getSingleUserByEmail({ _id: req.teammateId })

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
}

//Check ID and Token
exports.checkIdAndToken = async (req, res) => {
  try {
    let data = req.body
    let checkId = await userService.getSingleUserByEmail({ _id: req.params.userId })
    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Not verified"
      })
      // res.redirect(process.env.SITE_URL)
      return;
    }
    if (checkId.resetPasswordCode != req.params.code) {
      res.send({
        code: constant.errorCode,
        message: "Not verified"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Verified"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


//get s3 bucket file

AWS.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
  region: process.env.region
});

const S3FILE = new AWS.S3();

exports.downloadFile = async (req, res) => {
  try {
    const bucketName = process.env.bucket_name
    const key = "orderFile/file-1723638930538.xlsx"
    const params = {
      Bucket: bucketName,
      Key: key
    };
    const s3Object = await S3FILE.getObject(params).promise();

    // Set the headers to trigger a download in the browser
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    res.setHeader('Content-Type', s3Object.ContentType);

    // Send the file data to the client
    res.send(s3Object.Body);

  } catch (err) { 
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}