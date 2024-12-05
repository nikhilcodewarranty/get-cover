require("dotenv").config();
const userService = require("../../services/User/userService");
const customerService = require("../../services/Customer/customerService");
const dealerService = require('../../services/Dealer/dealerService')
const resellerService = require('../../services/Dealer/resellerService')
const dealerPriceService = require('../../services/Dealer/dealerPriceService')
const optionsService = require('../../services/User/optionsService')
const priceBookService = require('../../services/PriceBook/priceBookService')
const providerService = require('../../services/Provider/providerService')
const users = require("../../models/User/users");
const logs = require("../../models/User/logs");
const role = require("../../models/User/role");
const options = require('../../models/User/options');
const setting = require("../../models/User/setting");
const constant = require('../../config/constant');
const supportingFunction = require('../../config/supportingFunction')
const emailConstant = require('../../config/emailConstant');
const bcrypt = require("bcrypt");
const AWS = require('aws-sdk');
const jwt = require("jsonwebtoken");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
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


var storageLogo = multer.diskStorage({
  destination: function (req, files, cb) {
    cb(null, path.join(__dirname, '../../uploads/logo'));
  },
  filename: function (req, files, cb) {
    cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
  }
})

var logoUpload = multer({
  storage: storageLogo,
}).single("file");

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


const folderName = 'logo'; // Replace with your specific folder name

const StorageP = multerS3({
  s3: s3,
  bucket: process.env.bucket_name,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
    const fullPath = `${folderName}/${fileName}`;
    cb(null, fullPath);
  }
});

var imageUpload = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single("file");

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
    let roleQuery = { _id: user.metaData[0].roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    if (getRole.role == "Dealer") {
      let checkDealer = await dealerService.getDealerById(user.metaData[0].metaId)
      if (!checkDealer?.accountStatus) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Reseller") {
      let checkReseller = await resellerService.getReseller({ _id: user.metaData[0].metaId })
      if (!checkReseller?.status) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Servicer") {
      let checkServicer = await providerService.getServiceProviderById({ _id: user.metaData[0].metaId })
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
    let checkMasterPassword = await bcrypt.compare(req.body.password, process.env.masterPassword)
    if (!checkMasterPassword) {
      const passwordMatch = await bcrypt.compare(req.body.password, user.password);

      if (!passwordMatch) {
        res.send({
          code: constant.errorCode,
          message: "Invalid Credentials"
        })
        return;
      }
    }


    // Generate JWT token
    const token = jwt.sign(
      { userId: user.metaData[0].metaId ? user.metaData[0].metaId : user._id, teammateId: user._id, email: user.email, role: getRole.role, status: user.status },
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
          firstName: user.metaData[0].firstName,
          lastName: user.metaData[0].lastName
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
      email: data.email,
      password: hashedPassword,
      metaData: [
        {
          status: data.status,
          roleId: superRole._id,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          isPrimary: true,
          position: data.position,
          metaId: null
        }
      ]
    }

    // Create a new user with the provided data
    const savedUser = await userService.createUser(userData);

    let newMetaData = savedUser.metaData
    newMetaData[0].metaId = savedUser._id
    let updateUser = {
      metaData: newMetaData
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


    const users = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { roleId: checkRole._id, isDeleted: false } } }
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
    const singleUser = await userService.findUserforCustomer1([
      {
        $match: { _id: new mongoose.Types.ObjectId(userId) }
      },
      {
        $project: {
          email: 1,
          password: 1,
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
          updatedAt: 1,
          metaData:1
        }
      },
    ]);
    if (!singleUser[0]) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };
    let mainStatus;
    let criteria = { _id: singleUser[0].metaId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    console.log(checkCustomer, "checking the customer dta-------------------")
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.isAccountCreate : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser[0],
      mainStatus: mainStatus
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
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
    let option = { new: true };
    let checkUserId1 = await userService.findUserforCustomer1([
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.userId) }
      },
      {
        $project: {
          email: 1,
          password: 1,
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
    ])
    const settingData = await userService.getSetting({});
    let updateData = {
      $set: {
        notificationTo: ["anil@codenomad.net"],
        'metaData.$.firstName': data.firstName,
        'metaData.$.lastName': data.lastName,
        'metaData.$.position': data.position,
        'metaData.$.status': data.status,
        'metaData.$.metaId': checkUserId1[0].metaId,
        'metaData.$.roleId': checkUserId1[0].roleId

      }
    }
    let criteria = { metaData: { $elemMatch: { metaId: checkUserId1[0].metaId } }, _id: req.params.userId }
    const updateUser = await userService.updateSingleUser(criteria, updateData, option);
    console.log("fdfgdgdfgd", updateUser)
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
    const checkRole = await userService.getRoleById({ _id: updateUser.metaData[0].roleId }, {});

    const checkDealer = await dealerService.getDealerById(updateUser.metaId)

    const checkReseller = await resellerService.getReseller({ _id: updateUser.metaId }, { isDeleted: false })

    const checkCustomer = await customerService.getCustomerById({ _id: updateUser.metaId })

    const checkServicer = await providerService.getServiceProviderById({ _id: updateUser.metaId })


    //send notification to dealer when status change
    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({
      metaData: {
        $elemMatch: {
          metaId: updateUser.metaData[0].metaId,
          isPrimary: true
        }
      }
    })

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    let emailData;

    if (data.firstName) {
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: updateUser.metaData[0].firstName,
        content: "The user information has been updated successfully!.",
        subject: "Update User Info"
      }
    }

    else {
      const status_content = req.body.status ? 'Active' : 'Inactive';
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: updateUser.metaData[0].firstName,
        content: "Status has been changed to " + status_content + " " + ", effective immediately.",
        subject: "Update Status"
      }
    }


    if (checkServicer?.isAccountCreate || checkReseller?.isAccountCreate || checkDealer?.isAccountCreate || checkCustomer?.isAccountCreate) {
      notificationEmails.push(getPrimary.email);
      notificationEmails.push(updateUser.email);
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(updateUser.email, getPrimary.email, emailData))
      IDs.push(getPrimary._id)
    }
    else {
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
    }

    let notificationData = {
      title: checkRole.role + " " + "user change",
      description: "The  user has been changed!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);

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

    let updateInformation = await userService.findUserforCustomer1([
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.userId) }
      },
      {
        $project: {
          email: 1,
          password: 1,
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
    ])

    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result: updateInformation[0]
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
      if (checkEmail.metaData[0].status == false) {
        res.send({
          code: constant.errorCode,
          message: "This account is currently awaiting approval from the administrator"
        })
        return;
      }
      let resetLink = `${process.env.SITE_URL}newPassword/${checkEmail._id}/${resetPasswordCode}`

      let settingData = await userService.getSetting({});

      let data = {
        link: resetLink,
        name: checkEmail.metaData[0].firstName,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        title: settingData[0]?.title,
        websiteSetting: settingData[0],
        subject: "Set Password"
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
    console.log("checkUser-----------------------", checkUser)
    let settingData = await userService.getSetting({});
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
    const checkRole = await userService.getRoleById({ _id: checkUser?.metaData[0].roleId }, {});

    let primaryUser = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkUser?.metaData[0].metaId, isPrimary: true } } })

    //send notification to dealer when deleted
    let IDs = await supportingFunction.getUserIds()
    let notificationData = {
      title: "User Deletion",
      description: checkUser.metaData[0].firstName + " user has been deleted!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: [primaryUser._id]
    };

    let createNotification = await userService.createNotification(notificationData);

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();


    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: checkUser.metaData[0].firstName,
      content: "Your account has been deleted by Get-Cover team.",
      subject: "Delete User"
    }

    let notificationDataUpdate = primaryUser.notificationTo.filter(email => email != checkUser.email);

    let updateUser = await userService.updateSingleUser({ _id: primaryUser._id }, { notificationTo: notificationDataUpdate }, { new: true })

    const checkDealer = await dealerService.getDealerById(primaryUser.metaId)

    const checkReseller = await resellerService.getReseller({ _id: primaryUser.metaId }, { isDeleted: false })

    const checkCustomer = await customerService.getCustomerById({ _id: primaryUser.metaId })

    const checkServicer = await providerService.getServiceProviderById({ _id: primaryUser.metaId })

    if (checkServicer?.isAccountCreate || checkReseller?.isAccountCreate || checkDealer?.isAccountCreate || checkCustomer?.isAccountCreate) {
      notificationEmails.push(primaryUser.email);
      notificationEmails.push(checkUser.email);
      IDs.push(primaryUser._id)
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(checkUser.email, primaryUser.email, emailData))
    }
    else {
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))

    }
    // let notificationData = {
    //   title: "User Deletion",
    //   description: checkUser.firstName + " user has been deleted!",
    //   userId: req.teammateId,
    //   flag: checkRole.role,
    //   notificationFor: IDs
    // };

    // let createNotification = await userService.createNotification(notificationData);
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

    let checkUser = await userService.getUserById1({ email: email })
    let newMetaData = checkUser.metaData
    newMetaData[0].firstName = data.firstName
    newMetaData[0].lastName = data.lastName
    newMetaData[0].phoneNumber = data.phoneNumber
    newMetaData[0].position = data.position
    let updateProfile = await userService.updateSingleUser({ email: email }, { metaData: newMetaData }, { new: true })

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
      result: {
        "_id": updateProfile._id,
        "firstName": updateProfile.metaData[0].firstName,
        "lastName": updateProfile.metaData[0].lastName,
        "notificationTo": updateProfile.notificationTo,
        "email": updateProfile.email,
        "metaId": updateProfile.metaData[0].metaId,
        "position": updateProfile.metaData[0].position,
        "phoneNumber": updateProfile.metaData[0].phoneNumber,
        "dialCode": updateProfile.metaData[0].dialCode,
        "roleId": updateProfile.metaData[0].roleId,
        "isPrimary": updateProfile.metaData[0].isPrimary,
        "status": updateProfile.metaData[0].status,
        "approvedStatus": updateProfile.approvedStatus,
        "createdAt": updateProfile.createdAt,
        "updatedAt": updateProfile.updatedAt,
      }
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
    let criteria = { _id: singleUser.metaData[0].metaId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.status : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        "_id": singleUser._id,
        "firstName": singleUser.metaData[0].firstName,
        "lastName": singleUser.metaData[0].lastName,
        "notificationTo": singleUser.notificationTo,
        "email": singleUser.email,
        "metaId": singleUser.metaData[0].metaId,
        "position": singleUser.metaData[0].position,
        "phoneNumber": singleUser.metaData[0].phoneNumber,
        "dialCode": singleUser.metaData[0].dialCode,
        "roleId": singleUser.metaData[0].roleId,
        "isPrimary": singleUser.metaData[0].isPrimary,
        "status": singleUser.metaData[0].status,
        "approvedStatus": singleUser.approvedStatus,
        "createdAt": singleUser.createdAt,
        "updatedAt": singleUser.updatedAt,
      },
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

    const base_url = `${process.env.SITE_URL}manageAccount/`
    data.isPrimary = false;
    let getRole = await userService.getRoleById({ role: req.role })
    data.metaId = req.userId
    data.roleId = getRole._id
    let userData = {
      email: data.email,
      metaData: [
        {
          status: data.status,
          roleId: getRole._id,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          isPrimary: false,
          position: data.position,
          metaId: req.userId
        }
      ]
    }

    let saveData = await userService.createUser(userData)
    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the member"
      })
      return;
    };

    let notificationEmails = await supportingFunction.getUserEmails();

    let settingData = await userService.getSetting({});

    const adminQuery = {
      metaData: {
        $elemMatch: {
          roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
          status: true,
          "adminNotification.userAdded": true,
        }
      },
    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })

    const IDs = adminUsers.map(user => user._id)

    const admin = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true } } })

    let notificationData = {
      adminTitle: "New Admin User added",
      adminMessage: `A new admin user ${data.firstName} with Email ID ${data.email} has been added by ${admin.firstName}.`,
      userId: req.teammateId,
      contentId: null,
      redirectionId: base_url,
      flag: 'Member Created',
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: data.email }, { resetPasswordCode: resetPasswordCode }, { new: true });
    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
    const resetPassword = sgMail.send(emailConstant.servicerApproval(data.email, {
      flag: "created",
      link: resetLink, darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address, role: req.role == 'Super Admin' ? 'Admin' : req.role,
      subject: "Set Password",
      link: resetLink,
      title: settingData[0]?.title,
      servicerName: data.firstName,
      role: req.role == 'Super Admin' ? 'Admin' : req.role,
      servicerName: data.firstName
    }))
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
    let userMembers = await userService.findUserforCustomer1([
      {
        $match: {
          $and: [
            { metaData: { $elemMatch: { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            {
              $or: [
                { metaData: { $elemMatch: { metaId: new mongoose.Types.ObjectId(req.userId) } } },
                { _id: new mongoose.Types.ObjectId(req.userId) },
              ]
            },

          ]
        }
      },
      {
        $project: {
          email: 1,
          password: 1,
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
          notificationTo: 1,
          threshHoldLimit: 1,
          isThreshHoldLimit: 1,
          approvedStatus: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ])

    let userMember = await userService.findUserforCustomer1([
      {
        $match: { _id: new mongoose.Types.ObjectId(req.teammateId) }
      },
      {
        $project: {
          email: 1,
          password: 1,
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
          notificationTo: 1,
          threshHoldLimit: 1,
          isThreshHoldLimit: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ])
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: userMembers ? userMembers : [],
      loginMember: userMember[0]
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

// Setting Function
exports.accountSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    let data = req.body;
    data.setDefault = 0;
    data.userId = req.userId
    let response;
    const getData = await userService.getSetting({ userId: req.userId });
    if (getData.length > 0) {
      await userService.updateManySetting({}, { whiteLabelLogo: data.whiteLabelLogo }, { new: true });
      response = await userService.updateSetting({ _id: getData[0]?._id }, data, { new: true })

    }
    else {
      response = await userService.saveSetting(data)
    }

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: response
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Reset Setting 
exports.resetSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    // Define the default resetColor array

    let data = req.body;
    let response;
    const getData = await userService.getSetting({ userId: req.userId });
    let defaultResetColor = [];
    let defaultPaymentDetail = '';
    let defaultLightLogo = {};
    let defaultWhiteLabelLogo = {};

    let defaultDarkLogo = {};
    let defaultFavIcon = {};
    let defaultAddress = '';
    let defaultTitle = '';
    if (getData[0]?.defaultColor.length > 0) {
      defaultResetColor = getData[0]?.defaultColor
      defaultPaymentDetail = getData[0]?.defaultPaymentDetail
      defaultLightLogo = {
        fileName: getData[0].defaultLightLogo.fileName,
        name: getData[0].defaultLightLogo.name,
        size: getData[0].defaultLightLogo.size
      }
      defaultWhiteLabelLogo = {
        fileName: getData[0].defaultWhiteLabelLogo.fileName,
        name: getData[0].defaultWhiteLabelLogo.name,
        size: getData[0].defaultWhiteLabelLogo.size
      }
      defaultDarkLogo = {
        fileName: getData[0].defaultDarkLogo.fileName,
        name: getData[0].defaultDarkLogo.name,
        size: getData[0].defaultDarkLogo.size
      }
      defaultFavIcon = {
        fileName: getData[0].defaultFavIcon.fileName,
        name: getData[0].defaultFavIcon.name,
        size: getData[0].defaultFavIcon.size
      }
      defaultAddress = getData[0]?.defaultAddress
      defaultTitle = getData[0]?.defaultTitle
    }
    else {
      defaultResetColor = [
        {
          colorCode: "#303030",
          colorType: "sideBarColor"
        },
        {
          colorCode: "#fafafa",
          colorType: "sideBarTextColor"
        },
        {
          colorCode: "#f2f2f2",
          colorType: "sideBarButtonColor"
        },
        {
          colorCode: "#201d1d",
          colorType: "sideBarButtonTextColor"
        },
        {
          colorCode: "#343232",
          colorType: "buttonColor"
        },
        {
          colorCode: "#fffafa",
          colorType: "buttonTextColor"
        },
        {
          colorCode: "#f2f2f2",
          colorType: "backGroundColor"
        },
        {
          colorCode: "#333333",
          colorType: "textColor"
        },
        {
          colorCode: "#242424",
          colorType: "titleColor"
        },
        {
          colorCode: "#1a1a1a",
          colorType: "cardColor"
        },
        {
          colorCode: "#fcfcfc",
          colorType: "cardBackGroundColor"
        },
        {
          colorCode: "#fcfcfc",
          colorType: "modelBackgroundColor"
        },
        {
          colorCode: "#2b2727",
          colorType: "modelColor"
        }
      ];
    }
    response = await userService.updateSetting({ _id: getData[0]?._id }, {
      colorScheme: defaultResetColor,
      logoLight: defaultLightLogo,
      whiteLabelLogo: defaultWhiteLabelLogo,
      logoDark: defaultDarkLogo,
      favIcon: defaultFavIcon,
      title: defaultTitle,
      address: defaultAddress,
      paymentDetail: defaultPaymentDetail,
      setDefault: 1
    }, { new: true })
    res.send({
      code: constant.successCode,
      message: "Reset Successfully!!",
      result: response
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Set As default setting
exports.setDefault = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    // Define the default resetColor array
    let response;
    const getData = await userService.getSetting({ userId: req.userId });

    response = await userService.updateSetting({ _id: getData[0]?._id },
      {
        defaultColor: getData[0].colorScheme,
        setDefault: 1,
        defaultAddress: getData[0].address,
        defaultLightLogo: getData[0].logoLight,
        defaultWhiteLabelLogo: getData[0].whiteLabelLogo,
        defaultTitle: getData[0].title,
        defaultDarkLogo: getData[0].logoDark,
        defaultPaymentDetail: getData[0].paymentDetail,
        defaultFavIcon: getData[0].favIcon,
      },
      { new: true })

    res.send({
      code: constant.successCode,
      message: "Set as default successfully!",
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Setting Data
exports.getSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }

    let userId = req.userId
    let setting;
    if (req.role == "Reseller") {
      const checkReseller = await resellerService.getReseller({ _id: req.userId })
      userId = checkReseller.dealerId
    }
    if (req.role == "Customer") {
      const checkCustomer = await customerService.getCustomerById({ _id: req.userId })
      userId = checkCustomer.dealerId
    }
    setting = await userService.getSetting({ userId: userId });
    const baseUrl = process.env.API_ENDPOINT;
    if (setting.length > 0) {
      setting[0].base_url = baseUrl;

      // Assuming setting[0].logoDark and setting[0].logoLight contain relative paths
      if (setting[0].logoDark && setting[0].logoDark.fileName) {
        setting[0].logoDark.baseUrl = baseUrl;
      }

      if (setting[0].logoLight && setting[0].logoLight.fileName) {
        setting[0].logoLight.baseUrl = baseUrl;
      }

      if (setting[0].favIcon && setting[0].favIcon.fileName) {
        setting[0].favIcon.baseUrl = baseUrl;
      }
      if (setting[0].whiteLabelLogo && setting[0].whiteLabelLogo.fileName) {
        setting[0].whiteLabelLogo.baseUrl = baseUrl;
      }
      // Repeat for any other properties that need the base_url prepended
    }
    else {
      const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
      setting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
      if (setting.length > 0) {
        setting[0].base_url = baseUrl;

        // Assuming setting[0].logoDark and setting[0].logoLight contain relative paths
        if (setting[0].logoDark && setting[0].logoDark.fileName) {
          setting[0].logoDark.baseUrl = baseUrl;
        }

        if (setting[0].logoLight && setting[0].logoLight.fileName) {
          setting[0].logoLight.baseUrl = baseUrl;
        }

        if (setting[0].favIcon && setting[0].favIcon.fileName) {
          setting[0].favIcon.baseUrl = baseUrl;
        }
        if (setting[0].whiteLabelLogo && setting[0].whiteLabelLogo.fileName) {
          setting[0].whiteLabelLogo.baseUrl = baseUrl;
        }
        // Repeat for any other properties that need the base_url prepended
      }
    }
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: setting
    });
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//for pre login
exports.preLoginData = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
    let setting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
    const baseUrl = process.env.API_ENDPOINT;
    if (setting.length > 0) {
      setting[0].base_url = baseUrl;

      // Assuming setting[0].logoDark and setting[0].logoLight contain relative paths
      if (setting[0].logoDark && setting[0].logoDark.fileName) {
        setting[0].logoDark.baseUrl = baseUrl;
      }

      if (setting[0].logoLight && setting[0].logoLight.fileName) {
        setting[0].logoLight.baseUrl = baseUrl;
      }

      if (setting[0].favIcon && setting[0].favIcon.fileName) {
        setting[0].favIcon.baseUrl = baseUrl;
      }
      // Repeat for any other properties that need the base_url prepended
    }
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: setting
    });
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


exports.uploadLogo = async (req, res) => {
  try {
    logoUpload(req, res, async (err) => {
      let file = req.file;
      res.send({
        code: constant.successCode,
        message: 'Success!',
        result: {
          fileName: file.filename,
          name: file.originalname,
          size: file.size
        }
      })
    })
  }
  catch (err) {
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

//Download file
exports.downloadFile = async (req, res) => {
  try {

    let data = req.body
    const bucketName = process.env.bucket_name
    const key = req.body.key
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

//Alternate method for download
exports.downloadFile1 = async (req, res) => {
  try {
    let data = req.body
    const bucketName = process.env.bucket_name
    const key = req.param.folder + '/' + req.params.key
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

//Save contact Form Data
exports.contactUs = async (req, res) => {
  try {
    let data = req.body;
    const contactUs = await userService.contactUs(data);
    if (!contactUs) {
      res.send({
        code: constant.errorCode,
        message: "Unable to save contact for data!"
      });
      return
    }

    let adminCC = await supportingFunction.getUserEmails();

    let settingData = await userService.getSetting({});

    let emailData = {
      firstName: data.firstName,
      subject: 'Request Form Submision'
    }

    //Send email to user
    let mailing = sgMail.send(emailConstant.sendContactUsTemplate(data.email, adminCC, emailData))

    //Send to admin
    const admin = await supportingFunction.getPrimaryUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true });

    emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: admin.metaData[0]?.firstName,
      content: `A new user has submitted a request via the contact form`,
      subject: 'New Contact Form Submission'

    }
    //Send email to admin
    mailing = sgMail.send(emailConstant.sendEmailTemplate(adminCC, ["noreply@getcover.com"], emailData))
    res.send({
      code: constant.successCode,
      message: "Record save successfully!"
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Save Options dropdown backend use
exports.saveOptions = async (req, res) => {
  try {
    let data = req.body;
    let optionData;
    //Get option collection
    let getData = await optionsService.getOption({ name: data.name })
    if (!getData) {
      saveOptions = await optionsService.createOptions({ name: data.name, label: data.optionLabel, value: [{ label: data.label, value: data.value }] });
      if (!saveOptions) {
        res.send({
          code: constant.errorCode,
          message: "Unable to save contact for data!"
        });
        return
      }
    }
    else {
      let existData = await optionsService.getOption({ name: data.name, value: { $elemMatch: { value: { $regex: new RegExp("^" + data.value.toLowerCase(), "i") } } } })
      if (existData) {
        res.send({
          code: constant.errorCode,
          message: "The coverage type of this value is already exist!"
        });
        return
      }

      optionData = [];
      optionData.push({ label: data.label, value: data.value })
      saveOptions = await optionsService.updateEligibility({ name: data.name }, { $push: { value: optionData } }, { new: true })
    }

    res.send({
      code: constant.successCode,
      message: "Record save successfully!",
      result: saveOptions
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


//Get option from database
exports.getOptions = async (req, res) => {
  try {
    let filterOption = req.params.name
    const query = { name: filterOption, 'value.status': true }
    const getOptions = await userService.getOptions(query, { "value._id": 0, _id: 0 });
    if (!getOptions) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch data!"
      });
      return
    }
    res.send({
      code: constant.successCode,
      result: getOptions
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Multiple Dropdown
exports.getOptions1 = async (req, res) => {
  try {
    let filterOption = req.query.key
    const query = { name: { $in: filterOption } }
    console.log("sklfskdfjskjf", query)
    const getOptions = await userService.getMultipleOptions(query);
    if (!getOptions) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch data!"
      });
      return
    }
    const reorderedData = query.name['$in'].map(key => {
      return getOptions.find(item => item.name === key);
    });

    if (req.params.filter == 1) {
      for (let v = 0; v < reorderedData.length; v++) {
        reorderedData[v].value = reorderedData[v].value.filter(item => item.status === true)
      }
    }

    res.send({
      code: constant.successCode,
      result: reorderedData
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Multiple Dropdown
exports.editOption = async (req, res) => {
  try {
    let optionId = req.params.optionId
    const data = req.body.data

    let getOptionData = await userService.getOptions({ name: data.name })
    if (getOptionData.value.length > data.value.length) {
      res.send({
        code: constant.errorCode,
        message: "Invalid coverage types"
      })
      return
    }

    function checkUniqueLabelValue(array) {
      let labelSet = new Set();
      let valueSet = new Set();

      for (let obj of array) {
        // Check if the label or value already exists in the set
        if (labelSet.has(obj.label) || valueSet.has(obj.value)) {
          return new Error(`Duplicate found: ${obj.label} or ${obj.value} already exists`);
        }

        // Add label and value to the set
        labelSet.add(obj.label);
        valueSet.add(obj.value);
      }

      return "All labels and values are unique!";
    }

    // Example usage:
    let array = data.value

    let result = checkUniqueLabelValue(array);
    if (result instanceof Error) {
      res.send({ code: constant.errorCode, message: "Some fields are repeated" }) // Outputs: Duplicate found: Accidental or liquid_damage already exists
    } else {
      let updateOption = await userService.updateData({ name: data.name }, data, { new: true })
      if (!updateOption) {
        res.send({
          code: constant.errorCode,
          message: "Unable to process the request "
        })
      } else {
        res.send({
          code: constant.successCode,
          message: "Success",
          result: updateOption
        })
      }
    }
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateThreshHoldLimit = async (req, res) => {
  try {
    let data = req.body
    let updateAdmin = await userService.updateUser({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } }, { $set: { threshHoldLimit: data.threshHoldLimit, isThreshHoldLimit: data.isThreshHoldLimit } }, { new: true })
    if (!updateAdmin) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the limit"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Updated successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


exports.preLoginData = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
    let setting = await userService.getSetting({});
    const baseUrl = process.env.API_ENDPOINT;
    if (setting.length > 0) {
      setting[0].base_url = baseUrl;

      // Assuming setting[0].logoDark and setting[0].logoLight contain relative paths
      if (setting[0].logoDark && setting[0].logoDark.fileName) {
        setting[0].logoDark.baseUrl = baseUrl;
      }

      if (setting[0].logoLight && setting[0].logoLight.fileName) {
        setting[0].logoLight.baseUrl = baseUrl;
      }

      if (setting[0].favIcon && setting[0].favIcon.fileName) {
        setting[0].favIcon.baseUrl = baseUrl;
      }
      // Repeat for any other properties that need the base_url prepended
    }
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: setting
    });
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


const userModel = require("../../models/User/users")
exports.updateDataBase = async (req, res) => {

//   const adminQuery = {
//     metaData: {
//         $elemMatch: {
//             $and: [
//                 { "resellerNotifications.resellerAdded": true },
//                 { status: true },
//                 {
//                     $or: [
//                         { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
//                         { roleId: new mongoose.Types.ObjectId("656f08041eb1acda244af8c6") },
//                     ]
//                 }
//             ]
//         }
//     },
// }

//   let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })

//   const IDs = adminUsers.map(user => user._id)

//   console.log("dsdssdfsdfsdsdf",IDs,adminUsers)

//   return;
  
  try {
    let updateData = await userModel.updateMany(
      { metaData: { $exists: true } }, // Match documents with the `metaData` field
      {
        $set: {
          metaData: {
            $map: {
              input: "$metaData",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    orderNotifications: {
                      addingNewOrderPending: true,
                      addingNewOrderActive: true,
                      makingOrderPaid: true,
                      updateOrderPending: true,
                      updateOrderActive: true,
                      archivinOrder: true
                    },
                    claimNotification: {
                      newClaim: true,
                      fileBulkClaimAdmin: true,
                      fileBulkClaimDealer: true,
                      fileBulkClaimServicer: true,
                      fileBulkClaimReseller: true,
                      fileBulkClaimCustomer: true,
                      servicerUpdate: true,
                      customerStatusUpdate: true,
                      repairStatusUpdate: true,
                      claimStatusUpdate: true,
                      partsUpdate: true,
                      claimComment: true
                    },
                    adminNotification: {
                      userAdded: true,
                      categoryUpdate: true,
                      priceBookUpdate: true,
                      priceBookAdd: true,
                      unassignDealerServicer: true,
                      assignDealerServicer: true,
                      categoryAdded: true
                    },
                    servicerNotification: {
                      servicerAdded: true,
                      userAdded: true,
                      userUpdate: true,
                      primaryChanged: true,
                      userDelete: true
                    },
                    dealerNotifications: {
                      dealerAdded: true,
                      userAdded: true,
                      userUpdate: true,
                      primaryChanged: true,
                      userDelete: true,
                      dealerPriceBookUpload: true,
                      dealerPriceBookAdd: true,
                      dealerPriceBookUpdate: true
                    },
                    resellerNotifications: {
                      resellerAdded: true,
                      userAdd: true,
                      userUpdate: true,
                      primaryChange: true,
                      userDelete: true
                    },
                    customerNotifications: {
                      customerAdded: true,
                      userAdd: true,
                      userUpdate: true,
                      primaryChange: true,
                      userDelete: true
                    },
                    registerNotifications: {
                      dealerRegistrationRequest: true,
                      dealerServicerRequest: true,
                      dealerDisapproved: true,
                      servicerDisapproved: true
                    }
                  }
                ]
              }
            }
          }
        }
      }
    );
    res.send({
      code: 200,
      data: updateData
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

