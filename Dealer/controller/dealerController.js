require('dotenv').config()
const USER = require('../../User/model/users')
const dealerService = require("../services/dealerService");
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer");
const servicerService = require("../../Provider/services/providerService");
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant');
const XLSX = require("xlsx");
const LOG = require('../../User/model/logs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
const { id } = require('../validators/register_dealer');
const { string } = require('joi');
const resellerService = require('../services/resellerService');
const orderService = require('../../Order/services/orderService');
const order = require('../../Order/model/order');
const { constants } = require('buffer');
const logs = require('../../User/model/logs');
const supportingFunction = require('../../config/supportingFunction');
const providerService = require('../../Provider/services/providerService');
const { S3Client } = require('@aws-sdk/client-s3');
const aws = require('aws-sdk');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
aws.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
});
const S3Bucket = new aws.S3();
// s3 bucket connections
const s3 = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  }
});
const StorageP = multerS3({
  s3: s3,
  bucket: process.env.bucket_name, // Ensure this environment variable is set
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
    cb(null, fileName);
  }
});
var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single('file');

const checkObjectId = async (Id) => {
  // Check if the potentialObjectId is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(Id)) {
    return true;
  } else {
    return false;
  }
}

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

    let primaryUser = await supportingFunction.getPrimaryUser({ accountId: req.params.dealerId, isPrimary: true })

    let IDs = await supportingFunction.getUserIds()
    IDs.push(primaryUser._id)
    const notificationData = {
      title: "Dealer updated",
      description: data.name + " ," + "detail has beed updated ",
      userId: updatedDealer._id,
      flag: 'dealer',
      notificationFor: IDs
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

//Upload term and condition
exports.uploadTermAndCondition = async (req, res, next) => {
  try {
    uploadP(req, res, async (err) => {
      if (req.role != 'Super Admin') {
        res.send({
          code: constant.errorCode,
          message: 'Only suoer admin allow to do this action!'
        });
        return;
      }
      let file = req.file;
      //constant params
      const constantParams = {
        Bucket: process.env.bucket_name
      }
      const downloadParams = {
        Delimiter: '/',
        ...constantParams,
        Prefix: file.key
      };
      S3Bucket.listObjects(downloadParams, function (err, data) {
        if (err) throw err;
        console.log(data);
      });
      res.send({
        code: constant.successCode,
        message: 'Success!',
        
      })
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
    return
  }

}

//Register Dealer
exports.registerDealer = async (req, res) => {
  try {
    const data = req.body;
    // Check if the specified role exists
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
      let logData = {
        endpoint: "register dealer",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unbale to create the dealer"
        }
      }
      await LOG(logData).save()
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
      metaId: createdDealer._id,
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

    let IDs = await supportingFunction.getUserIds()

    let notificationData = {
      title: "New Dealer Registration",
      description: data.name + " " + "has finished registering as a new dealer. For the onboarding process to proceed more quickly, kindly review and give your approval.",
      userId: req.teammateId,
      redirectionId: createdDealer._id,
      flag: 'Dealer Request',
      notificationFor: IDs
    };
    // Create the user
    let createNotification = await userService.createNotification(notificationData);
    let emailData = {
      dealerName: createdDealer.name,
      subject: "New Dealer Registration Request Received",
      c1: "Thank you for",
      c2: "Registering! as a",
      c3: "Your account is currently pending approval from our admin.",
      c4: "Once approved, you will receive a confirmation emai",
      c5: "We appreciate your patience.",
      role: "Dealer"
    }
    let mailing = sgMail.send(emailConstant.dealerWelcomeMessage(data.email, emailData))
    const admin = await supportingFunction.getPrimaryUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true })
    const notificationEmail = await supportingFunction.getUserEmails();
    emailData = {
      senderName: admin.firstName,
      subject: "Notification of New Dealer Registration",
      content: "A new dealer " + createdDealer.name + " has been registered"
    }
    mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmail, [], emailData))
    let logData = {
      endpoint: "register dealer",
      body: data,
      response: {
        code: constant.successCode,
        message: "created",
        data: createdDealer
      }
    }
    await LOG(logData).save()
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

//Update Status
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

    const priceBookData = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(existingDealerPriceBook.priceBook) }, {})

    // Update the dealer price status
    const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

    if (!updatedResult) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer price status"
      });

      return;
    }

    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: existingDealerPriceBook.dealerId, isPrimary: true })
    IDs.push(getPrimary._id)
    let getDealerDetail = await dealerService.getDealerByName({ _id: existingDealerPriceBook.dealerId })
    let notificationData = {
      title: "Dealer price book updated",
      description: getDealerDetail.name + " , " + "your price book has been updated",
      userId: req.teammateId,
      contentId: req.params.dealerPriceBookId,
      redirectionId: getDealerDetail._id,
      flag: 'Dealer Price Book',
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    let emailData = {
      senderName: getPrimary.firstName,
      content: "The price book " + priceBookData[0]?.pName + " has been updated",
      subject: "Update Price Book"
    }

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))

    let logData = {
      userId: req.teammateId,
      endpoint: "dealer/statusUpdate",
      body: newValue,
      response: {
        code: constant.successCode,
        message: "Updated Successfully",
        data: updatedResult
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      data: updatedResult
    });

    return

  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "dealer/statusUpdate catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return
  }
};

//Change Dealer Status
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
      //Archeive All orders when dealer inactive
      let orderCreteria = { dealerId: req.params.dealerId, status: 'Pending' };
      let updateStatus = await orderService.updateManyOrder(orderCreteria, { status: 'Archieved' }, { new: true })

      const updateDealerServicer = await providerService.updateServiceProvider({ dealerId: req.params.dealerId }, { status: false })

    }

    else {
      if (singleDealer.isAccountCreate) {
        let dealerUserCreateria = { accountId: req.params.dealerId, isPrimary: true };
        let newValue = {
          $set: {
            status: req.body.status
          }
        };
        let option = { new: true };
        const changeDealerUser = await userService.updateUser(dealerUserCreateria, newValue, option);
      }
    }
    option = { new: true };
    //Update Dealer Status
    newValue = {
      $set: {
        accountStatus: req.body.status,
        // status: req.body.status,
      }
    };
    if (singleDealer.isServicer) {
      let updateServicer = await providerService.updateServiceProvider({ dealerId: singleDealer._id }, { status: req.body.status })
    }

    const changedDealerStatus = await dealerService.updateDealerStatus({ _id: req.params.dealerId }, newValue, option);
    if (changedDealerStatus) {
      let IDs = await supportingFunction.getUserIds()
      let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.params.dealerId, isPrimary: true })

      IDs.push(getPrimary._id)
      let notificationData = {
        title: "Dealer status update",
        description: singleDealer.name + ", " + "your status has been updated",
        userId: req.teammateId,
        redirectionId: singleDealer.name,
        flag: 'dealer',
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      const status_content = req.body.status ? 'Active' : 'Inactive';
      let emailData = {
        senderName: singleDealer.name,
        content: "Status has been changed to " + status_content + " " + ", effective immediately.",
        subject: "Update Status"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
      let logData = {
        userId: req.teammateId,
        endpoint: "dealer/changeDealerStatus",
        body: changedDealerStatus,
        response: {
          code: constant.successCode,
          message: 'Updated Successfully!',
        }
      }
      await LOG(logData).save()
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
    let logData = {
      endpoint: "dealer/changeDealerStatus",
      body: {
        type: "catch error"
      },
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Create Dealer Price Book
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
    let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(data.priceBook) }, {})

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
        message: "Dealer price book already created with this product sku"
      })
      return;
    }

    let createDealerPrice = await dealerPriceService.createDealerPrice(data)

    if (!createDealerPrice) {
      let logData = {
        userId: req.teammateId,
        endpoint: "dealer/createPriceBook",
        body: req.body,
        response: {
          code: constant.errorCode,
          message: "Unable to create the dealer price book"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to create the dealer price book"
      })
    } else {
      let IDs = await supportingFunction.getUserIds()
      let getPrimary = await supportingFunction.getPrimaryUser({ accountId: data.dealerId, isPrimary: true })
      IDs.push(getPrimary._id)
      let notificationData = {
        title: "New dealer price book created",
        description: data.priceBook + " , " + "new price book has been created",
        userId: req.teammateId,
        flag: 'Dealer Price Book',
        contentId: createDealerPrice._id,
        redirectionId: createDealerPrice._id,
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
      let emailData = {
        senderName: checkDealer.name,
        content: "The price book name" + " " + checkPriceBookMain[0]?.pName + " has been created successfully! effective immediately.",
        subject: "New Price Book"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
      let logData = {
        userId: req.teammateId,
        endpoint: "dealer/createPriceBook",
        body: req.body,
        response: {
          code: constant.successCode,
          message: "Success",
          result: createDealerPrice
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.successCode,
        message: "Success",
        result: createDealerPrice
      })
    }
  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "dealer/createPriceBook catch",
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
    })
  }
}

//Check dealer price book 
exports.checkDealerPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerById(data.dealerId)
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
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

    res.send({
      code: constant.successCode,
      message: "Success!"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Reject dealer from admin
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
      let IDs = await supportingFunction.getUserIds()
      let getPrimary = await supportingFunction.getPrimaryUser({ accountId: singleDealer._id, isPrimary: true })
      IDs.push(getPrimary._id)
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
      let notificationData = {
        title: "Rejection Dealer Account",
        description: "The " + singleDealer.name + " account has been rejected!",
        userId: req.teammateId,
        flag: 'dealer',
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      // Primary User Welcoime email
      let notificationEmails = await supportingFunction.getUserEmails();
      let emailData = {
        senderName: singleDealer.name,
        content: "Dear " + singleDealer.name + ",\n\nWe regret to inform you that your registration as a dealer has been rejected by our admin team. If you have any questions or require further assistance, please feel free to contact us.\n\nBest regards,\nAdmin Team",
        subject: "Rejection Account"
      }
      // Send Email code here
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
      //Delete the user

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

//update dealer details
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

    let criteria1 = { _id: checkDealer._id }
    let option = { new: true }
    data.name = data.accountName
    let updatedData = await dealerService.updateDealer(criteria1, data, option)
    if (!updatedData) {
      //Save Logs update dealer
      let logData = {
        userId: req.userId,
        endpoint: "dealer/updateDealerMeta",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the data"
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
    }
    else {
      let criteria = { dealerId: checkDealer._id }
      let option = { new: true }
      let updatedCustomer = await customerService.updateDealerName(criteria, { dealerName: data.accountName }, option)
      //Update dealer name in reseller
      let updateResellerDealer = await resellerService.updateMeta(criteria, { dealerName: data.accountName }, option)

      //Update Meta in servicer also     
      if (data.isServicer) {
        const checkServicer = await servicerService.getServiceProviderById({ dealerId: checkDealer._id })
        if (!checkServicer) {
          const CountServicer = await servicerService.getServicerCount();
          let servicerObject = {
            name: data.accountName,
            street: data.street,
            city: data.city,
            zip: data.zip,
            dealerId: checkDealer._id,
            state: data.state,
            country: data.country,
            status: data.status,
            accountStatus: "Approved",
            unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
          }
          let createData = await servicerService.createServiceProvider(servicerObject)
        }

        else {
          const servicerMeta = {
            name: data.accountName,
            city: data.city,
            country: data.country,
            street: data.street,
            zip: data.zip
          }
          const updateServicerMeta = await servicerService.updateServiceProvider(criteria, servicerMeta)
        }
      }
    }
    //update primary user to true by default
    if (data.isAccountCreate && checkDealer.accountStatus) {
      await userService.updateSingleUser({ metaId: checkDealer._id, isPrimary: true }, { status: true }, { new: true })
    }
    if (!data.isAccountCreate) {
      await userService.updateUser({ metaId: checkDealer._id }, { status: false }, { new: true })
    }
    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
    IDs.push(getPrimary._id)
    let notificationData = {
      title: "Dealer updated",
      description: checkDealer.name + " , " + "details has been updated",
      userId: req.teammateId,
      redirectionId: data.dealerId,
      flag: 'dealer',
      notificationFor: IDs
    };

    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here 
    let notificationEmails = await supportingFunction.getUserEmails();
    let emailData = {
      senderName: checkDealer.name,
      content: "The information has been updated successfully! effective immediately.",
      subject: "Update Info"
    }

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
    //Save Logs update dealer
    let logData = {
      userId: req.userId,
      endpoint: "dealer/updateDealerMeta",
      body: data,
      response: {
        code: constant.successCode,
        message: "Success",
        result: updatedData
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.successCode,
      message: "Success",
      result: updatedData
    })
  } catch (err) {
    //Save Logs update dealer
    let logData = {
      userId: req.userId,
      endpoint: "dealer/updateDealerMeta catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//add dealer user
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

    let checkEmail = await userService.findOneUser({ email: data.email }, {})

    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email"
      })
      return;
    }

    data.accountId = checkDealer._id
    data.metaId = checkDealer._id
    data.roleId = '656f08041eb1acda244af8c6'
    let statusCheck;

    if (!checkDealer.accountStatus) {
      statusCheck = false
    } else {
      statusCheck = data.status
    }

    data.status = statusCheck
    let saveData = await userService.createUser(data)

    if (!saveData) {
      //Save Logs create Customer
      let logData = {
        userId: req.userId,
        endpoint: "/addDealerUser",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to add the data"
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to add the data"
      })
    } else {
      let IDs = await supportingFunction.getUserIds()
      let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
      IDs.push(getPrimary._id)

      let notificationData = {
        title: "New user added",
        description: checkDealer.name + " , " + "new user has been added",
        userId: req.teammateId,
        contentId: saveData._id,
        flag: 'dealer',
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      //Save Logs create Customer
      let logData = {
        userId: req.userId,
        endpoint: "/addDealerUser",
        body: data,
        response: {
          code: constant.successCode,
          message: "Added successfully",
          result: saveData
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "Added successfully",
        result: saveData
      })
    }
  } catch (err) {
    //Save Logs create Customer
    let logData = {
      userId: req.userId,
      endpoint: "/addDealerUser catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//upload dealer price book
exports.uploadDealerPriceBook = async (req, res) => {
  try {
    uploadP(req, res, async (err) => {
      let file = req.file
      let data = req.body
      let checkDealer = await dealerService.getSingleDealerById({ _id: new mongoose.Types.ObjectId(req.body.dealerId) }, { isDeleted: false })
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
      const wb = XLSX.readFile(req.file.path);
      const sheets = wb.SheetNames;
      const ws = wb.Sheets[sheets[0]];
      let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
      totalDataComing1 = totalDataComing1.map(item => {
        if (!item['Product SKU']) {
          return { priceBook: '', 'RetailPrice': item['retailPrice'] };
        }
        return item;
      });
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
          retailPrice: item[keys[1]],
          duplicates: [],
          exit: false
        };
      });
      // copy to here
      totalDataComing.forEach((data, index) => {

        if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
          data.status = "Dealer catalog retail price is not valid";
          totalDataComing[index].retailPrice = data.retailPrice
          data.exit = true;
        }
        else {
          data.status = null
        }
      })

      if (totalDataComing.length > 0) {
        const repeatedMap = {};

        for (let i = totalDataComing.length - 1; i >= 0; i--) {
          if (totalDataComing[i].exit) {
            continue;
          }

          if (repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] >= 0) {
            totalDataComing[i].status = "not unique";
            totalDataComing[i].exit = true;
            const index = repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()];
            totalDataComing[index].duplicates.push(i);
          } else {
            repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] = i;
            totalDataComing[i].status = null;
          }
        }

        const pricebookArrayPromise = totalDataComing.map(item => {
          let queryPrice;
          if (checkDealer[0]?.coverageType == "Breakdown & Accidental") {
            queryPrice = queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true }

          } else {
            queryPrice = queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true, coverageType: checkDealer[0]?.coverageType }
          }

          if (!item.status) return priceBookService.findByName1(queryPrice);
          return null;
        })

        const pricebooksArray = await Promise.all(pricebookArrayPromise);

        for (let i = 0; i < totalDataComing.length; i++) {
          if (!pricebooksArray[i]) {
            if (!totalDataComing[i].exit) {
              totalDataComing[i].status = "price catalog does not exist";
              totalDataComing[i].duplicates.forEach((index) => {
                totalDataComing[index].status = "price catalog does not exist";
              })
            }
            totalDataComing[i].priceBookDetail = null
          } else {
            totalDataComing[i].priceBookDetail = pricebooksArray[i];
          }
        }

        const dealerArrayPromise = totalDataComing.map(item => {
          if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(data.dealerId), priceBook: item.priceBookDetail._id }, {});
          return false;
        })

        const dealerArray = await Promise.all(dealerArrayPromise);
        for (let i = 0; i < totalDataComing.length; i++) {
          if (totalDataComing[i].priceBookDetail) {
            if (dealerArray[i]) {
              dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
              dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
              await dealerArray[i].save();

              totalDataComing[i].status = "Dealer catalog updated successully-";
              totalDataComing[i].duplicates.forEach((index) => {
                totalDataComing[index].status = "Dealer catalog updated successully_";
              })

            } else {
              const count = await dealerPriceService.getDealerPriceCount();
              let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
              let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;
              let checkSavedPricebook = await dealerPriceService.createDealerPrice({
                dealerId: data.dealerId,
                priceBook: totalDataComing[i].priceBookDetail._id,
                unique_key: unique_key,
                status: true,
                retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                wholesalePrice
              })
              totalDataComing[i].status = "Dealer catalog updated successully!"
              totalDataComing[i].duplicates.forEach((index, i) => {
                let msg = index === 0 ? "Dealer catalog created successully)" : "Dealer catalog created successully%"
                totalDataComing[index].status = msg;
              })
            }
          }
        }

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

        //Send notification to admin,dealer,reseller

        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: req.body.dealerId, isPrimary: true })
        IDs.push(dealerPrimary?._id)
        let notificationData = {
          title: "Dealer Price Book Uploaded",
          description: "The priceBook has been successfully uploaded",
          userId: req.teammateId,
          flag: 'Dealer Price Book',
          notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);
        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        const mailing = sgMail.send(emailConstant.sendCsvFile(dealerPrimary.email, notificationEmails, htmlTableString));
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

//Create relation with dealer
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

    // Step 3: Delete existing records
    let deleteData = await dealerRelationService.deleteRelations({
      dealerId: new mongoose.Types.ObjectId(req.params.dealerId),
      servicerId: { $in: uncheckId }
    });
    // Step 4: Insert new records
    const newRecords = newServicerIds.map(servicerId => ({
      dealerId: req.params.dealerId,
      servicerId: servicerId
    }));
    if (newRecords.length > 0) {
      let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
      //Save Logs create dealer relation
      let logData = {
        userId: req.userId,
        endpoint: "dealer/createRelationWithServicer/:dealerId",
        body: data,
        response: {
          code: constant.successCode,
          message: "Success",
          result: saveData
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "success"
      })
    } else {
      //Save Logs create dealer relation
      let logData = {
        userId: req.userId,
        endpoint: "dealer/createRelationWithServicer/:dealerId",
        body: data,
        response: {
          code: constant.successCode,
          message: "Success",
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Unassign the servicer
exports.unAssignServicer = async (req, res) => {
  try {
    let data = req.body
    let deleteRelation = await dealerRelation.findOneAndDelete({ servicerId: data.servicerId, dealerId: data.dealerId })
    if (!deleteRelation) {
      //Save Logs unAssignedServicer
      let logData = {
        userId: req.userId,
        endpoint: "dealer/unAssignServicer",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to unassign",
          result: deleteRelation
        }
      }
      await LOG(logData).save()
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
    //Save Logs unAssignedServicer
    let logData = {
      userId: req.userId,
      endpoint: "dealer/unAssignServicer catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
