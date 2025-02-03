require('dotenv').config()
const USER = require('../../models/User/users')
const randtoken = require('rand-token').generator()

const dealerService = require("../../services/Dealer/dealerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const maillogservice = require("../../services/User/maillogServices")
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerRelation = require("../../models/Provider/dealerServicer");
const servicerService = require("../../services/Provider/providerService");
const userService = require("../../services/User/userService");
const role = require("../../models/User/role");
const dealer = require("../../models/Dealer/dealer");
const constant = require('../../config/constant');
const LOG = require('../../models/User/logs')
const emailConstant = require('../../config/emailConstant');
const resellerService = require('../../services/Dealer/resellerService');
const orderService = require('../../services/Order/orderService');
const order = require('../../models/Order/order');
const logs = require('../../models/User/logs');
const supportingFunction = require('../../config/supportingFunction');
const providerService = require('../../services/Provider/providerService');
const axios = require('axios');
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
const { string } = require('joi');
const { constants } = require('buffer');
const { S3Client } = require('@aws-sdk/client-s3');
const aws = require('aws-sdk');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const eligibilityService = require('../../services/Dealer/eligibilityService');
const contractService = require('../../services/Contract/contractService');
const claimService = require('../../services/Claim/claimService');
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

//Upload Code waranty Images
const autherUpload = multerS3({
  s3: s3,
  bucket: process.env.bucket_name,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {

    let flag = req.query.flag

    let folderName;
    // Example: Set folderName based on file.fieldname
    if (flag === 'bannerImage') {
      folderName = 'banner';
    } else if (flag === 'authorImage') {
      folderName = 'author';
    } else if (flag === 'thumbnailImage') {
      folderName = 'thumbnail';
    }


    const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
    const fullPath = `${folderName}/${fileName}`;
    cb(null, fullPath);
  }
});

var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single('file');


var codewarrantyImages = multer({
  storage: autherUpload,
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

    let primaryUser = await supportingFunction.getPrimaryUser({ metaId: req.params.dealerId, isPrimary: true })

    let IDs = await supportingFunction.getUserIds()
    if (updatedDealer.isAccountCreate) {
      IDs.push(primaryUser._id)
    }
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
      let file = req.file;
      file.fileName = file.key
      file.filename = file.key
      // Log or process the content as needed

      res.send({
        code: constant.successCode,
        message: 'Success!',
        file

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

exports.uploadBannerImage = async (req, res, next) => {
  try {
    codewarrantyImages(req, res, async (err) => {
      let file = req.file;

      // file.fileName = file.key
      // file.filename = file.key
      // Log or process the content as needed

      res.send({
        code: constant.successCode,
        message: 'Success!',
        file

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
    const base_url = `${process.env.SITE_URL}newDealerList/${req.body.name}`

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
    console.log("checking the data for dealer ak +++++++++++++++", existingDealer)
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
      let checkDealer = await dealerService.getDealerByName({ _id: pendingUser.metaData[0]?.metaId })
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
      metaData: [
        {
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          roleId: checkRole._id,
          metaId: createdDealer._id,
          isPrimary:true
        }
      ]

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
    const adminQuery = {
      metaData: {
        $elemMatch: {
          roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
          status: true,
          "registerNotifications.dealerRegistrationRequest": true,
        }
      },

    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })

    const IDs = adminUsers.map(user => user._id)

    let settingData = await userService.getSetting({});

    let notificationData = {
      title: "New Dealer Request",
      description: "A New Dealer " + data.name + " has registered with us on the portal",
      userId: req.teammateId,
      redirectionId: "newDealerList/" + req.body.name,
      endPoint: base_url,
      flag: 'Dealer Request',
      notificationFor: IDs
    };
    // Create the user
    let createNotification = await userService.createNotification(notificationData);
    let emailData = {
      dealerName: createdDealer.name,
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      subject: "New Dealer Registration Request Received",
      c1: "Thank you for",
      c2: "Registering! as a",
      c3: "Your account is currently pending approval from our admin.",
      c4: "Once approved, you will receive a confirmation emai",
      c5: "We appreciate your patience.",
      role: "Dealer"
    }
    let mailing = await sgMail.send(emailConstant.dealerWelcomeMessage(data.email, emailData))
    await maillogservice.createMailLogFunction(mailing, emailData, [userMetaData], process.env.main_template)

    const admin = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true } } })
    const notificationEmail = adminUsers.map(user => user.email)
    emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: `Dear Admin`,
      subject: "Notification of New Dealer Registration",
      content: "A new dealer " + createdDealer.name + " has been registered"
    }
    if (notificationEmail.length > 0) {
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmail, [], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }


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
    let data = req.body
    const projection = { isDeleted: 0, __v: 0 };
    const existingDealerPriceBook = await dealerPriceService.getDealerPriceById(criteria, projection);
    if (!existingDealerPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Price Book not found"
      });
      return;
    }
    if (data.dealerSku != existingDealerPriceBook.dealerSku) {
      const dealerSkuCheck = await dealerPriceService.getDealerPriceById({ dealerId: existingDealerPriceBook.dealerId, dealerSku: data.dealerSku }, projection);


      if (dealerSkuCheck) {
        res.send({
          code: constant.errorCode,
          message: "Dealer price book already created with this dealer sku"
        })
        return;
      }
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
        dealerSku: req.body.dealerSku,
        retailPrice: req.body.retailPrice || existingDealerPriceBook.retailPrice,
        priceBook: req.body.priceBook || existingDealerPriceBook.priceBook,
        adhDays: req.body.adhDays || existingDealerPriceBook.adhDays,
        noOfClaim: req.body.noOfClaim || existingDealerPriceBook.noOfClaim,
        noOfClaimPerPeriod: req.body.noOfClaimPerPeriod || existingDealerPriceBook.noOfClaimPerPeriod,
        isManufacturerWarranty: req.body.isManufacturerWarranty || existingDealerPriceBook.isManufacturerWarranty,
        isMaxClaimAmount: req.body.isMaxClaimAmount || existingDealerPriceBook.isManufacturerWarranty,

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
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminDealerPriceUpdateQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "dealerNotifications.dealerPriceBookUpdate": true },
            { status: true },
            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
          ]
        }
      },
    }

    const dealerPriceUpdateQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "dealerNotifications.dealerPriceBookUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(data.dealerId) },
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerPriceUpdateQuery, { email: 1, metaData: 1 })
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerPriceUpdateQuery, { email: 1, metaData: 1 })
    const IDs = adminUsers.map(user => user._id)
    const IDs1 = dealerUsers.map(user => user._id)
    let settingData = await userService.getSetting({});

    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: existingDealerPriceBook.dealerId, isPrimary: true } } })
    //Merge start singleServer
    // let getPrimary = await supportingFunction.getPrimaryUser({ metaId: existingDealerPriceBook.dealerId, isPrimary: true })
    //Merge end
    let getDealerDetail = await dealerService.getDealerByName({ _id: existingDealerPriceBook.dealerId })
    let notificationArrayData = []
    if (existingDealerPriceBook.status == data.status) {
      let notificationData = {
        title: "Dealer PriceBook Updated",
        description: `Dealer Pricebook ${priceBookData[0]?.pName} for ${getDealerDetail.name} has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: req.params.dealerPriceBookId,
        flag: 'Dealer Price Book',
        redirectionId: "dealerPriceList/" + getDealerDetail.name + "/" + data.dealerSku,
        notificationFor: IDs,
        endPoint: base_url + "dealerPriceList/" + getDealerDetail.name + "/" + data.dealerSku,
      };
      let notificationData1 = {
        title: "Price Book Updated",
        description: `Pricebook ${priceBookData[0]?.pName} has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: req.params.dealerPriceBookId,
        flag: 'Dealer Price Book',
        redirectionId: "dealer/priceBook/" + data.dealerSku,
        notificationFor: IDs1,
        endPoint: base_url + "dealer/priceBook/" + data.dealerSku
      };

      notificationArrayData.push(notificationData)
      notificationArrayData.push(notificationData1)
    }
    else {
      let notificationData2 = {
        title: "Dealer Pricebook  Status Updated",
        description: `Dealer Pricebook ${priceBookData[0]?.pName} for ${getDealerDetail.name} status has been updated to ${data.status ? "Active" : "Inactive"} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: req.params.dealerPriceBookId,
        flag: 'Dealer Price Book',
        redirectionId: "dealerPriceList/" + getDealerDetail.name + "/" + existingDealerPriceBook.dealerSku,
        notificationFor: IDs,
        endPoint: base_url + "dealerPriceList/" + getDealerDetail.name + "/" + existingDealerPriceBook.dealerSku
      };

      let notificationData3 = {
        title: "Pricebook  Status updated",
        description: `Pricebook ${priceBookData[0]?.pName} status has been updated to ${data.status ? "Active" : "Inactive"} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
        userId: req.teammateId,
        contentId: req.params.dealerPriceBookId,
        flag: 'Dealer Price Book',
        redirectionId: "dealer/priceBook/" + existingDealerPriceBook.dealerSku,
        notificationFor: IDs1,
        endPoint: base_url + "dealer/priceBook/" + existingDealerPriceBook.dealerSku
      };

      notificationArrayData.push(notificationData2)
      notificationArrayData.push(notificationData3)
    }

    let createNotification = await userService.saveNotificationBulk(notificationArrayData);
    // Send Email code here
    let notificationEmails = adminUsers.map(user => user.email)
    let dealerEmails = dealerUsers.map(user => user.email)
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: getPrimary.metaData[0]?.firstName,
      content: "The price book " + priceBookData[0]?.pName + " has been updated",
      subject: "Update Price Book"
    }
    //check if account create true
    if (notificationEmails.length > 0) {
      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }
    if (dealerEmails.length > 0) {
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)
    }


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

      let dealerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.dealerId } } }

      let changeDealerUser = await userService.updateUser(dealerUserCreateria, {
        $set: {
          'metaData.$.status': req.body.status,
        }
      }, { new: true })

      //Archeive All orders when dealer inactive
      let orderCreteria = { dealerId: req.params.dealerId, status: 'Pending' };
      let updateStatus = await orderService.updateManyOrder(orderCreteria, { status: 'Archieved' }, { new: true })

      const updateDealerServicer = await providerService.updateServiceProvider({ dealerId: req.params.dealerId }, { status: false })


    }

    else {
      if (singleDealer.isAccountCreate) {

        let dealerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.dealerId, isPrimary: true } } }

        let changeDealerUser = await userService.updateUser(dealerUserCreateria, {
          $set: {
            'metaData.$.status': req.body.status,
          }
        }, { new: true })

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
      const status_content = req.body.status ? 'Active' : 'Inactive';
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      const adminDealerrQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerUpdate": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
            ]
          }
        },
      }

      const dealerrQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerUpdate": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(req.params.dealerId) }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerrQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerrQuery, { email: 1, metaData: 1 })
      let IDs = adminUsers.map(user => user._id)
      let adminEmails = adminUsers.map(user => user.email)
      let IDs1 = dealerUsers.map(user => user._id)
      console.log("adminUsers-------------------", adminUsers)
      console.log("dealerUsers-------------------", dealerUsers)
      console.log("IDs", IDs);
      console.log("IDs1", IDs1);

      let notificationData = {
        title: "Dealer Status Updated",
        description: `The Dealer ${singleDealer.name} status has been updated to ${status_content} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        redirectionId: "dealerDetails/" + singleDealer._id,
        flag: 'dealer',
        endPoint: base_url + "dealerDetails/" + singleDealer._id,
        notificationFor: IDs
      };

      let notificationData1 = {
        title: "Status Updated",
        description: `GetCover has updated your status to ${status_content}.`,
        userId: req.teammateId,
        redirectionId: null,
        flag: 'dealer',
        endPoint: null,
        notificationFor: IDs1
      };

      let notificationArrayData = [];
      notificationArrayData.push(notificationData)
      notificationArrayData.push(notificationData1)
      console.log("notificationArrayData------------------", notificationArrayData)
      let createNotification = await userService.saveNotificationBulk(notificationArrayData);
      const content = req.body.status ? 'Congratulations, you can now login to our system. Please click the following link to login to the system' : "Your account has been made inactive. If you think, this is a mistake, please contact our support team at support@getcover.com"
      // Send Email code here
      let primaryUser = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.dealerId, isPrimary: true } } })

      let dealerEmails = dealerUsers.map(user => user.email)
      let settingData = await userService.getSetting({});
      let resetPasswordCode = randtoken.generate(4, '123456789')

      let resetLink = `${process.env.SITE_URL}newPassword/${primaryUser._id}/${resetPasswordCode}`

      let emailData = {
        senderName: singleDealer.name,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        content: content,
        redirectId: status_content == "Active" ? resetLink : '',
        subject: "Update Status"
      }

      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(primaryUser.email, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, [primaryUser], process.env.update_status)

      emailData = {
        senderName: singleDealer.name,
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        content: `Dealer status has been changed to ${status_content}`,
        redirectId: '',
        subject: "Update Status"
      }
      emailData.senderName = "Dear Admin"
      if (adminEmails.length > 0) {
        mailing = await sgMail.send(emailConstant.sendEmailTemplate(adminEmails, ["noreply@getcover.com"], emailData))
        await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
      }
      emailData.senderName = `Dear ${primaryUser.metaData[0]?.firstName + "" + primaryUser.metaData[0]?.lastName}`
      if (dealerEmails.length > 0) {
        mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
        await maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)
      }
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

    let checkCategory = await priceBookService.getPriceCatById({ _id: new mongoose.Types.ObjectId(data.categoryId) }, {})

    if (!checkCategory) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category"
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


    let checkDealerSku = await dealerPriceService.getDealerPriceById({ dealerSku: data.dealerSku, dealerId: data.dealerId }, {})

    if (checkDealerSku) {
      res.send({
        code: constant.errorCode,
        message: "Dealer price book already created with this dealer sku"
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
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      const adminDealerPriceBookQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerPriceBookAdd": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
            ]
          }
        },
      }
      const dealerPriceBookQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerPriceBookAdd": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(data.dealerId) }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerPriceBookQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerPriceBookQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      const IDs1 = dealerUsers.map(user => user._id)
      let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.dealerId, isPrimary: true } } })
      let settingData = await userService.getSetting({})
      let notificationData = {
        title: "New Dealer Pricebook Added",
        description: `A new Dealer Pricebook ${checkPriceBookMain[0].pName} for ${checkDealer.name} has been added under category ${checkCategory.name} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        flag: 'Dealer Price Book',
        tabAction: "priceBook",
        contentId: createDealerPrice._id,
        redirectionId: "dealerPriceList/" + checkDealer.name + "/" + data.dealerSku,
        notificationFor: IDs,
        endPoint: base_url + "dealerPriceList/" + checkDealer.name + "/" + data.dealerSku

      };

      let notificationData1 = {
        title: "New Pricebook Added",
        description: `A new  Pricebook ${checkPriceBookMain[0].pName} has been added under category ${checkCategory.name} by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        flag: 'Dealer Price Book',
        contentId: createDealerPrice._id,
        redirectionId: "dealer/priceBook/" + data.dealerSku,
        notificationFor: IDs1,
        endPoint: base_url + "dealer/priceBook/" + data.dealerSku,

      };
      let notificationArrayData = [];
      notificationArrayData.push(notificationData);
      notificationArrayData.push(notificationData1);

      let createNotification = await userService.saveNotificationBulk(notificationArrayData);
      // Send Email code here
      let notificationEmails = adminUsers.map(user => user.email)
      let dealerEmails = dealerUsers.map(user => user.email)
      let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: `Dear ${checkDealer.name}`,
        content: "The price book name" + " " + checkPriceBookMain[0]?.pName + " has been created successfully! effective immediately.",
        subject: "New Price Book"
      }
      if (notificationEmails.length > 0) {
        let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
        await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
      }
      if (dealerEmails.length > 0) {
        mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
        await maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)
      }
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

//Only for backend use 
exports.saveOldDealerSku = async (req, res) => {
  try {
    const dealerPriceBooks = await dealerPriceService.getAllDealerPrice();
    let updatedPriceBook;
    let bulk = [];
    for (let i = 0; i < dealerPriceBooks.length; i++) {
      const dealerId = dealerPriceBooks[i]._id
      const name = dealerPriceBooks[i].priceBooks.name
      const newValue = { dealerSku: name };
      const option = { new: true };
      updatedPriceBook = await dealerPriceService.updateDealerPrice({ _id: dealerId }, newValue, option);
    }

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: updatedPriceBook
    })
    //res.send(bulk)
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: "Unable to save dealer sku"
    })
  }
}

//Only for backend use 
exports.oldDealers = async (req, res) => {
  try {
    const dealers = await dealerService.getAllDealers();
    for (let i = 0; i < dealers.length; i++) {
      const dealerId = dealers[i]._id
      const coverageType = dealers[i].coverageType
      let updateCoverage;
      if (coverageType == "Breakdown & Accidental") {
        updateCoverage = [
          {
            "label": "Breakdown",
            "value": "breakdown"
          },
          {
            "label": "Accidental",
            "value": "accidental"
          }
        ]
      }
      if (coverageType == "Breakdown") {
        updateCoverage = [
          {
            "label": "Breakdown",
            "value": "breakdown"
          }
        ]
      }
      if (coverageType == "Accidental") {
        updateCoverage = [
          {
            "label": "Accidental",
            "value": "accidental"
          },
        ]
      }

      console.log("updateCoverage--------------------", updateCoverage)
      console.log("dealerId--------------------", dealerId)
      const newValue = { coverageType: coverageType };
      const option = { new: true };
      updatedPriceBook = await dealerService.updateDealerMany({ _id: dealerId }, newValue, option);
    }

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: updatedPriceBook
    })
    //res.send(bulk)
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: "Unable to save dealer sku"
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
    let settingData = await userService.getSetting({});
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      })
      return;
    }

    //if status is rejected
    if (req.body.status == 'Rejected') {
      let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: singleDealer._id, isPrimary: true } } })
      const deleteUser = await userService.deleteUser({ metaData: { $elemMatch: { metaId: req.params.dealerId } } })
      // const deleteUser = await userService.deleteUser({ metaId: req.params.dealerId })
      //Merge end
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

      //Send Notification to dealer 
      const adminQuery = {
        metaData: {
          $elemMatch: {
            roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
            status: true,
            "registerNotifications.dealerDisapproved": true,
          }
        },

      }

      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })

      let notificationData = {
        title: "Dealer Rejected",
        description: `Request for the new dealer ${singleDealer.name} has been rejected by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}.`,
        userId: req.teammateId,
        flag: 'dealer',
        endPoint: null,
        redirectionId: null,
        notificationFor: IDs
      };

      let createNotification = await userService.createNotification(notificationData);
      // Primary User Welcoime email
      let notificationEmails = await supportingFunction.getUserEmails();
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: singleDealer.metaData[0]?.name,
        content: "Dear " + singleDealer.name + ",\n\nWe regret to inform you that your registration as a dealer has been rejected by our admin team. If you have any questions or require further assistance, please feel free to contact us.\n\nBest regards,\nAdmin Team",
        subject: "Rejection Account"
      }
      // Send Email code here
      if (singleDealer.isAccountCreate) {
        let mailing = await sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
        await maillogservice.createMailLogFunction(mailing, emailData, [getPrimary], process.env.update_status)

      } else {
        if (notificationEmails.length > 0) {
          let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
          await maillogservice.createMailLogFunction(mailing, emailData, [getPrimary], process.env.update_status)
        }
      }

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
    let coverageType = data.coverageType

    // data.coverageType = coverageType.map(types => types.value);

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

      let updateDealerServicerAccount = await servicerService.updateServiceProvider(criteria, {
        name: data.accountName,
        city: data.city,
        country: data.country,
        street: data.street,
        zip: data.zip
      })
    }
    //update primary user to true by default
    if (checkDealer.accountStatus) {
      let criteria1 = { metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } }

      let updateMetaData = await userService.updateSingleUser(criteria1, {
        $set: {
          'metaData.$.status': true,
        }
      }, { new: true })

    }

    //Send Notification to admin and dealer
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminDealerrQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "dealerNotifications.dealerUpdate": true },
            { status: true },
            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
          ]
        }
      },
    }
    const dealerrQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "dealerNotifications.dealerUpdate": true },
            { status: true },
            { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerrQuery, { email: 1, metaData: 1 })
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerrQuery, { email: 1, metaData: 1 })
    const IDs = adminUsers.map(user => user._id)
    const IDs1 = dealerUsers.map(user => user._id)
    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
    let settingData = await userService.getSetting({});

    let notificationData = {
      title: "Dealer Details Updated",
      description: `The details for the Dealer ${checkDealer.name} has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      userId: req.teammateId,
      redirectionId: data.dealerId,
      flag: 'dealer',
      endPoint: base_url + "dealerDetails/" + checkDealer._id,
      redirectionId: "dealerDetails/" + checkDealer._id,
      notificationFor: IDs
    };
    let notificationData1 = {
      title: "Details Updated",
      description: `The details for your account has been changed by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      userId: req.teammateId,
      redirectionId: data.dealerId,
      flag: 'dealer',
      endPoint: base_url + "dealer/user",
      redirectionId: "dealer/user",
      notificationFor: IDs1
    };

    let notificationArrayData = [];
    notificationArrayData.push(notificationData)
    notificationArrayData.push(notificationData1)

    let createNotification = await userService.saveNotificationBulk(notificationArrayData);
    // Send Email code here 
    let notificationEmails = adminUsers.map(user => user.email)
    const dealerEmail = dealerUsers.map(user => user.email)

    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: `Dear ${checkDealer.name},`,
      content: "Your details have been updated. To view the details, please login into your account.",
      subject: "Update Info"
    }
    if (notificationEmails.length > 0) {
      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
    }
    if (dealerEmail.length > 0) {
      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)
    }
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

exports.updateDealerSetting = async (req, res) => {
  try {
    let data = req.body
    let checkDealerId = await dealerService.getDealerByName({ _id: req.params.dealerId })
    if (!checkDealerId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }

    let updateData = await dealerService.updateDealer({ _id: req.params.dealerId }, data, { new: true })
    if (!updateData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer setttings"
      })
      return
    }
    //update primary user to true by default
    if (data.isAccountCreate && checkDealerId.accountStatus) {
      await userService.updateSingleUser({ metaData: { $elemMatch: { metaId: req.params.dealerId, isPrimary: true } } }, { status: true }, { new: true })
    }
    if (!data.isAccountCreate) {
      await userService.updateUser({ metaData: { $elemMatch: { metaId: req.params.dealerId } } }, { status: false }, { new: true })
    }
    //Update Meta in servicer also 
    console.log("typeOf", typeof (data.isServicer))

    if (data.isServicer) {
      const checkServicer = await servicerService.getServiceProviderById({ dealerId: checkDealerId._id })
      if (!checkServicer) {
        console.log("if mai")

        const CountServicer = await servicerService.getServicerCount();
        let servicerObject = {
          name: checkDealerId.name,
          street: checkDealerId.street,
          city: checkDealerId.city,
          zip: checkDealerId.zip,
          dealerId: checkDealerId._id,
          state: checkDealerId.state,
          country: checkDealerId.country,
          status: checkDealerId.accountStatus,
          accountStatus: "Approved",
          unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
        }
        let createData = await servicerService.createServiceProvider(servicerObject)
        console.log("createData-----------------", createData)
        console.log("servicerObject-----------------", servicerObject)
      }

      else {
        console.log("else mai")

        let criteria = { dealerId: checkDealerId._id }
        let option = { new: true }
        const servicerMeta = {
          name: checkDealerId.name,
          city: checkDealerId.city,
          country: checkDealerId.country,
          street: checkDealerId.street,
          zip: checkDealerId.zip
        }
        const updateServicerMeta = await servicerService.updateServiceProvider(criteria, servicerMeta)
      }
    }

    let updateSettingData = await eligibilityService.updateEligibility({ userId: req.params.dealerId }, data, { new: true })
    if (!updateSettingData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
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

//add dealer user
exports.addDealerUser = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId }, {})
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`

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
    let statusCheck;

    if (!checkDealer.accountStatus) {
      statusCheck = false
    } else {
      statusCheck = data.status
    }

    let metaData = {
      email: data.email,
      metaData: [
        {
          metaId: checkDealer._id,
          status: statusCheck,
          roleId: "656f08041eb1acda244af8c6",
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          position: data.position,
          isPrimary: false,
          dialCode: data.dialCode ? data.dialCode : "+1"

        }
      ]

    }
    let saveData = await userService.createUser(metaData)
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
      const adminDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.userAdded": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
            ]
          }
        },
      }
      const dealerDealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.userAdded": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerDealerQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      const adminEmails = adminUsers.map(user => user.email)
      const IDs1 = dealerUsers.map(user => user._id)
      const dealerEmails = dealerUsers.map(user => user.email)
      let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })

      let notificationData = {
        title: "Dealer User Added",
        description: `A new user for Dealer ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: saveData._id,
        tabAction: "dealerUser",
        flag: 'dealer',
        endPoint: base_url + "dealerDetails/" + checkDealer._id,
        redirectionId: "/dealerDetails/" + checkDealer._id,
        notificationFor: IDs
      };

      let notificationData1 = {
        title: "New User Added",
        description: `A new user for your account has been added by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: saveData._id,
        flag: 'dealer',
        endPoint: base_url + "dealer/user",
        redirectionId: "dealer/user",
        notificationFor: IDs1
      };

      let notificationArrayData = [];
      notificationArrayData.push(notificationData)
      notificationArrayData.push(notificationData1)
      let settingData = await userService.getSetting({});

      let createNotification = await userService.saveNotificationBulk(notificationArrayData);
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: `Dear ${getPrimary.metaData[0].firstName + " " + getPrimary.metaData[0].lastName}`,
        content: `A new user for Dealer ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        subject: "Dealer User Added"
      };
      let mailing = await sgMail.send(emailConstant.sendEmailTemplate(adminEmails, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: `Dear ${getPrimary.metaData[0].firstName + " " + getPrimary.metaData[0].lastName}`,
        content: `A new user has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        subject: "User Added"
      };
      mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
      await maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)

      //Send Reset Password
      let resetPasswordCode = randtoken.generate(4, '123456789')
      let email = data.email;
      let userId = saveData._id;
      let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
      mailing = await sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role + " " + "User", dealerName: data.firstName + " " + data?.lastName }))
      emailData = { subject: "Set Password", link: resetLink, role: req.role + " " + "User", dealerName: data.firstName + " " + data?.lastName }
      await maillogservice.createMailLogFunction(mailing, emailData, [saveData], process.env.approval_mail)
      let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
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
      //Get from S3 Bucket
      const bucketReadUrl = { Bucket: process.env.bucket_name, Key: file.key };
      // Await the getObjectFromS3 function to complete
      const result = await getObjectFromS3(bucketReadUrl);

      let responseData = result.data;


      let dataComing = responseData.map((item, i) => {
        const keys = Object.keys(item);
        return {
          priceBook: item[keys[0]],
          dealerSku: item[keys[1]] != "" ? item[keys[1]] : item[keys[0]],
          retailPrice: item[keys[2]],
        };
      });

      let totalDataComing1 = dataComing.map(item => {
        if (!item['priceBook']) {
          return { priceBook: '', dealerSku: item['dealerSku'], 'RetailPrice': item['retailPrice'] };
        }
        return item;
      });

      const headers = result.headers

      if (headers.length !== 3) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file format detected. The sheet should contain exactly three columns."
        })
        return
      }

      const totalDataComing = totalDataComing1.map(item => {
        const keys = Object.keys(item);
        return {
          priceBook: item[keys[0]],
          dealerSku: item[keys[1]],
          retailPrice: item[keys[2]],
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
              dealerArray[i].dealerSku = totalDataComing[i].dealerSku != undefined ? totalDataComing[i].dealerSku : dealerArray[i].dealerSku;
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
                dealerSku: totalDataComing[i].dealerSku != "" ? totalDataComing[i].dealerSku : 0,
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
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        const adminUploadQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "dealerNotifications.dealerPriceBookUpload": true },
                { status: true },
                {
                  $or: [
                    { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                  ]
                }
              ]
            }
          },
        }
        const dealerUploadQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "dealerNotifications.dealerPriceBookUpload": true },
                { status: true },
                {
                  $or: [
                    { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
                  ]
                }
              ]
            }
          },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUploadQuery, { email: 1, metaData: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUploadQuery, { email: 1, metaData: 1 })


        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: req.body.dealerId, isPrimary: true })
        let notificationData = {
          title: "Dealer Pricebook file added successfully",
          description: `The Bulk file ${file.fieldName} of dealer pricebook has been uploaded and processed successfully for dealer ${checkDealer.name}. The file has been uploaded by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: 'Dealer Price Book',
          tabAction: "priceBook",
          notificationFor: IDs,
          endPoint: base_url + "dealerDetails/" + req.body.dealerId,
          redirectionId: "/dealerDetails/" + req.body.dealerId
        };
        let createNotification = await userService.createNotification(notificationData);

        notificationData = {
          title: "Pricebook added successfully",
          description: `The Bulk file ${file.fieldName} of  pricebook has been uploaded and processed successfully. The file has been uploaded by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
          userId: req.teammateId,
          flag: 'Dealer Price Book',
          notificationFor: dealerId,
          endPoint: base_url + "dealer/priceBook",
          redirectionId: "/dealer/priceBook"
        };
        createNotification = await userService.createNotification(notificationData);
        // Send Email code here
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)
        if (notificationEmails.length > 0) {
          let mailing = await sgMail.send(emailConstant.sendCsvFile(notificationEmails, ["noreply@getcover.com"], htmlTableString));
          // maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)

        }
        if (notificationEmails.length > 0) {
          let mailing = await sgMail.send(emailConstant.sendCsvFile(notificationEmails, ["noreply@getcover.com"], htmlTableString));
          // maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)

        }
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

exports.uploadDealerPriceBookNew = async (req, res) => {
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
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let getDealerSetting = await eligibilityService.getEligibility({ userId: req.body.dealerId })
      console.log("get dealer checkLoginUser +++++++++++", checkLoginUser)

      let adhDays = checkDealer[0].adhDays
      let noOfClaim = getDealerSetting.noOfClaim
      let noOfClaimPerPeriod = getDealerSetting.noOfClaimPerPeriod
      let isMaxClaimAmount = getDealerSetting.isMaxClaimAmount
      let isManufacturerWarranty = getDealerSetting.isManufacturerWarranty

      if (!req.file) {
        res.send({
          code: constant.errorCode,
          message: "No file uploaded"
        })
        return;
      }
      //Get from S3 Bucket
      const bucketReadUrl = { Bucket: process.env.bucket_name, Key: file.key };
      // Await the getObjectFromS3 function to complete
      const result = await getObjectFromS3(bucketReadUrl);

      let responseData = result.data;
      const headers = result.headers

      if (headers.length !== 3) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file format detected. The sheet should contain exactly three columns."
        })
        return
      }

      let totalDataComing = responseData.map(item => {
        let keys = Object.keys(item);

        return {
          productSku: item[keys[0]],  // First key's value
          dealerSku: item[keys[1]],   // Second key's value
          retailPrice: item[keys[2]]  // Third key's value
        };
      });

      let lastOccurrenceMap = {};

      // Track the first occurrence of each productSku
      totalDataComing.forEach((item, index) => {
        if (!(item.productSku in lastOccurrenceMap)) {
          lastOccurrenceMap[item.productSku] = index;
        }
      });

      // Add the isExist key, making the first occurrence true
      totalDataComing = totalDataComing.map((item, index) => {
        if (item.dealerSku === "") {
          item.dealerSku = item.productSku;
        }

        return {
          ...item,
          isExist: index === lastOccurrenceMap[item.productSku]
        };
      });

      function checkForDuplicateDealerSku(data) {
        let dealerSkuMap = {};

        for (let item of totalDataComing) {
          // If dealerSku is already mapped and the productSku is different, return an error
          if (dealerSkuMap[item.dealerSku] && dealerSkuMap[item.dealerSku] !== item.productSku) {
            res.send({
              code: constant.errorCode,
              message: "Duplicate dealerSku found for different productSkus"
            })
            return
            // { error: `Duplicate dealerSku found for different productSkus: ${item.dealerSku}` };
          }

          // Otherwise, add the dealerSku to the map
          dealerSkuMap[item.dealerSku] = item.productSku;
        }
      }
      let newArray = []
      const optionQuery = {
        value: {
          $elemMatch: {
            value: { $in: checkDealer[0].coverageType }
          }
        }
      }

      const dynamicOption = await userService.getOptions(optionQuery)
      const filteredOptions = dynamicOption.value
        .filter(item => !checkDealer[0].coverageType.includes(item.value))
        .map(item => item.value);

      for (let s = 0; s < totalDataComing.length; s++) {
        let currentData = totalDataComing[s]
        // if (currentData.isExist) {

        let checkPriceBook = await priceBookService.findByName1({
          name: { '$regex': new RegExp(`^${currentData.productSku.trim()}$`, 'i') }, coverageType: { $elemMatch: { value: { $in: checkDealer[0].coverageType } } }, "coverageType.value": {
            $nin: filteredOptions
          }
        })
        console.log("checking the dealer price book-----------", checkPriceBook)

        if (checkPriceBook) {
          let wholeSalePrice = Number(checkPriceBook.frontingFee) + Number(checkPriceBook.reserveFutureFee) + Number(checkPriceBook.reinsuranceFee) + Number(checkPriceBook.adminFee)
          let checkDealerSku = await dealerPriceService.getDealerPriceById({ priceBook: checkPriceBook._id, dealerId: data.dealerId })
          if (checkDealerSku) {
            if (!currentData.retailPrice) {

              currentData.message = "Retail price is missing"
            } else {
              let checkDealerSku1 = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, dealerSku: currentData.dealerSku.trim() })
              if (checkDealerSku1) {
                if (checkDealerSku1.priceBook.toString() == checkPriceBook._id.toString()) {
                  let brokerFee = currentData.retailPrice - wholeSalePrice
                  let updateDealerPriceBook = await dealerPriceService.updateDealerPrice({ _id: checkDealerSku._id }, { retailPrice: currentData.retailPrice, brokerFee: brokerFee, dealerSku: currentData.dealerSku.trim() }, { new: true })
                  currentData.message = "Updated successfully"
                } else {
                  currentData.message = "Dealer sku already exist"
                }
              } else {
                let brokerFee = currentData.retailPrice - wholeSalePrice
                let updateDealerPriceBook = await dealerPriceService.updateDealerPrice({ _id: checkDealerSku._id }, { retailPrice: currentData.retailPrice, brokerFee: brokerFee, dealerSku: currentData.dealerSku.trim() }, { new: true })
                currentData.message = "Updated successfully"
              }
            }
          } else {
            if (!currentData.retailPrice) {

              currentData.message = "Retail price is missing"
            } else {
              let checkDealerSku1 = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, dealerSku: currentData.dealerSku.trim() })
              if (checkDealerSku1) {
                currentData.message = "Dealer sku already exist"
              } else {
                console.log("else condition---------1111111111", currentData.retailPrice, wholeSalePrice)
                let brokerFee = currentData.retailPrice - wholeSalePrice
                let updateAdh = checkPriceBook.coverageType.map(item1 => {
                  // Find a match in array2
                  let match = adhDays.find(item2 => item2.value === item1.value);

                  // Return the merged object only if there's a match
                  return match ? { ...item1, ...match } : item1;
                });
                let createDealerPriceBook = await dealerPriceService.createDealerPrice({ priceBook: checkPriceBook._id, dealerSku: currentData.dealerSku.trim(), retailPrice: currentData.retailPrice, status: true, dealerId: data.dealerId, brokerFee: brokerFee, wholesalePrice: wholeSalePrice, adhDays: updateAdh, noOfClaim: noOfClaim, noOfClaimPerPeriod: noOfClaimPerPeriod, isMaxClaimAmount: isMaxClaimAmount, isManufacturerWarranty: isManufacturerWarranty })
                // code to be added here
                currentData.message = "created successfully"
              }
            }

          }
        } else {
          currentData.message = "Product sku does not exist"
        }
        newArray.push(currentData)

      }
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

      const htmlTableString = convertArrayToHTMLTable(newArray);

      //Send notification to admin,dealer,reseller

      const adminUploadQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerPriceBookUpload": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
            ]
          }
        },
      }

      const dealerUploadQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "dealerNotifications.dealerPriceBookUpload": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(req.body.dealerId) },
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUploadQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUploadQuery, { email: 1, metaData: 1 })
      const IDs = adminUsers.map(user => user._id)
      const adminEmail = adminUsers.map(user => user.email)
      const IDs1 = dealerUsers.map(user => user._id)
      const dealerEmail = dealerUsers.map(user => user.email)
      let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: req.body.dealerId, isPrimary: true })
      let notificationData = {
        title: "Dealer Pricebook file added successfully",
        description: `The Bulk file ${req.file.originalname} of dealer pricebook has been uploaded and processed successfully for dealer ${checkDealer[0].name}. The file has been uploaded by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        tabAction: "priceBook",
        flag: 'Dealer Price Book',
        notificationFor: IDs,
        endPoint: base_url + "dealerDetails/" + req.body.dealerId,
        redirectionId: "dealerDetails/" + req.body.dealerId
      };
      let notificationData1 = {
        title: "Pricebook added successfully",
        description: `The Bulk file ${req.file.originalname} of  pricebook has been uploaded and processed successfully. The file has been uploaded by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        flag: 'Dealer Price Book',
        notificationFor: IDs1,
        endPoint: base_url + "dealer/priceBook",
        redirectionId: "dealer/priceBook"
      };

      let notificationArrayData = []
      notificationArrayData.push(notificationData)
      notificationArrayData.push(notificationData1)

      let createNotification = await userService.saveNotificationBulk(notificationArrayData);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();

      let mailing = await sgMail.send(emailConstant.sendCsvFile(dealerEmail, "noreply@getcover.com", htmlTableString));
      maillogservice.createMailLogFunctionWithHtml(mailing, dealerUsers, htmlTableString)


      mailing = await sgMail.send(emailConstant.sendCsvFile(adminEmail, "noreply@getcover.com", htmlTableString));

      maillogservice.createMailLogFunctionWithHtml(mailing, adminUsers, htmlTableString)


      res.send({
        code: constant.successCode,
        message: "Uploaded Successfully"
      })

    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get File data from S3 bucket
const getObjectFromS3 = (bucketReadUrl) => {
  return new Promise((resolve, reject) => {
    S3Bucket.getObject(bucketReadUrl, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const wb = XLSX.read(data.Body, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        let headers = [];

        for (let cell in sheet) {
          if (
            /^[A-Z]1$/.test(cell) &&
            sheet[cell].v !== undefined &&
            sheet[cell].v !== null &&
            sheet[cell].v.trim() !== ""
          ) {
            headers.push(sheet[cell].v);
          }
        }

        const result = {
          headers: headers,
          data: XLSX.utils.sheet_to_json(sheet, { defval: "" }),
        };

        resolve(result);
      }
    });
  });
};
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
    const allServiceProvider = await servicerService.getAllServiceProvider({ _id: { $in: newServicerIds } }, {});
    if (newRecords.length > 0) {
      let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
      const adminAssignServicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },

            ]
          }
        },
      }
      const dealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
            ]
          }
        },
      }
      const servicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.assignDealerServicer": true },
              { status: true },
              {
                $or: [
                  { metaId: { $in: newServicerIds } },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminAssignServicerQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1, metaData: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerQuery, { email: 1, metaData: 1 })

      const IDs = adminUsers.map(user => user._id)
      const dealerId = dealerUsers.map(user => user._id)
      const servicerId = servicerUsers.map(user => user._id)
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let notificationArray = {
        title: "Servicer Assigned to Dealer",
        description: `We are reaching out to notify you about a recent update regarding the servicer list assigned to ${checkDealer.name}`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "servicer",
        notificationFor: IDs,
        redirectionId: "/dealerDetails/" + req.params.dealerId,
        endPoint: base_url + "dealerDetails/" + req.params.dealerId
      };


      let createNotification = await userService.createNotification(notificationArray);

      notificationArray = {
        title: "Servicer Assigned",
        description: `We are reaching out to notify you about a recent update regarding the servicer list assigned to you`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: dealerId,
        redirectionId: "/dealer/servicerList",
        endPoint: base_url + "dealer/servicerList"
      };


      createNotification = await userService.createNotification(notificationArray);

      notificationArray = {
        title: "Dealer Assigned",
        description: `We are reaching out to notify you about a recent update regarding the dealer list assigned to you`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: servicerId,
        redirectionId: "/servicer/dealerList",
        endPoint: base_url + "servicer/dealerList"
      }


      createNotification = await userService.createNotification(notificationArray);

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
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId })

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
      const allServiceProvider = await servicerService.getAllServiceProvider({ _id: data.servicerId }, {});

      const adminAssignServicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.unassignDealerServicer": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },

            ]
          }
        },
      }
      const dealerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.unassignDealerServicer": true },
              { status: true },
              { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
            ]
          }
        },
      }
      const servicerQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.unassignDealerServicer": true },
              { status: true },
              {
                $or: [
                  { metaId: { $in: data.servicerId } },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminAssignServicerQuery, { email: 1, metaData: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1, metaData: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerQuery, { email: 1, metaData: 1 })

      const IDs = adminUsers.map(user => user._id)
      const dealerId = dealerUsers.map(user => user._id)
      const servicerId = servicerUsers.map(user => user._id)
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const base_url = `${process.env.SITE_URL}`
      let notificationArray = allServiceProvider.map(servicer => ({
        title: "Servicer Unassigned to Dealer",
        description: `We have successfully unassigned the servicer ${servicer.name} from the  Dealer ${checkDealer.name} by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "servicer",
        notificationFor: IDs,
        redirectionId: "/dealerDetails/" + data.dealerId,
        endPoint: base_url + "dealerDetails/" + data.dealerId
      }));


      let createNotification = await userService.saveNotificationBulk(notificationArray);

      notificationArray = allServiceProvider.map(servicer => ({
        title: "Servicer Unassigned",
        description: `Servicer ${servicer.name}  have been unassigned for future repairs from your account by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: dealerId,
        redirectionId: "/dealer/servicerList",
        endPoint: base_url + "dealer/servicerList"
      }));


      createNotification = await userService.saveNotificationBulk(notificationArray);

      notificationArray = {
        title: "Dealer Unassigned",
        description: `Dealer ${checkDealer.name} have been unassigned for future repairs from your account by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: null,
        flag: 'Assigned Servicer',
        tabAction: "",
        notificationFor: servicerId,
        redirectionId: "/servicer/dealerList",
        endPoint: base_url + "servicer/dealerList"
      }


      createNotification = await userService.createNotification(notificationArray);

      // let notificationData = {
      //   title: "Servicer Unassigned to Dealer",
      //   adminTitle: "Servicer Unassigned to Dealer",
      //   dealerTitle: "Servicer Unassigned",
      //   servicerTitle: "Dealer Unassigned",
      //   adminMessage: `We have successfully unassigned the servicer from the Dealer ${checkDealer.name} by ${checkLoginUser.metaData[0]?.firstName}.`,
      //   dealerMessage: `Servicer have been unassigned for future repairs from your account by ${checkLoginUser.metaData[0]?.firstName}`,
      //   servicerMessage: `Dealer have been unassigned for future repairs from your account by ${checkLoginUser.metaData[0]?.firstName}`,
      //   description: `We have successfully assigned the servicer to Dealer ${checkDealer.name} by ${checkLoginUser.metaData[0]?.firstName}.`,
      //   userId: req.teammateId,
      //   contentId: null,
      //   flag: 'Assigned Servicer',
      //   notificationFor: IDs,
      //   redirectionId: "/dealerDetails/" + req.params.dealerId,
      //   endPoint: base_url
      // };
      // let createNotification = await userService.createNotification(notificationData);
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

exports.checkEligibiltyForContracts = async (req, res) => {
  try {
    let data = req.body
    let getOrder = await orderService.getOrder({ _id: data.orderId })
    if (!getOrder) {
      console.log("check  111111++++++++++++++++++++++++++++++++++++++++++++++++++")
      return { code: 401, message: "Invalid order ID" }
    }
    let dealerQuery = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(getOrder.dealerId)
        }
      },
      {
        $lookup: {
          from: "eligibilticriterias",
          localField: "_id",
          foreignField: "userId",
          as: "settings"
        }
      },
      {
        $unwind: "$settings"
      }
    ]

    let getDealerAndSettings = await dealerService.getDealerAndClaims(dealerQuery)

    console.log("check  222222++++++++++++++++++++++++++++++++++++++++++++++++++")

    let dealerSettings = getDealerAndSettings[0].settings
    // let getContractByOrder = await contractService.getAllContracts([
    //   {
    //     $match: {
    //       orderId: getOrder._id
    //     }
    //   }
    // ])

    // check for any open claim and number of claim 

    let getOrderContract = await contractService.findContracts2({ orderId: data.orderId })

    if (!getOrderContract) {
      console.log("check  3333333++++++++++++++++++++++++++++++++++++++++++++++++++")
      return { code: 401, message: "Unable to get the order contract" }

    }

    let checkClaim;
    let minDate;
    let claimAmount;

    for (let i = 0; i < getOrderContract.length; i++) {
      let contract = getOrderContract[i]
      let getAdhDays = getOrder.productsArray.filter(product => product._id.toString() == contract.orderProductId.toString())

      let adhDaysArray = getAdhDays[0].adhDays

      adhDaysArray.sort((a, b) => a.waitingDays - b.waitingDays);


      const futureDate = new Date(contract.coverageStartDate);
      minDate = futureDate.setDate(futureDate.getDate() + adhDaysArray[0].waitingDays);

      console.log(adhDaysArray[0].waitingDays, contract.coverageStartDate, new Date(minDate))

      claimAmount = 200
      let claimQuery = [
        {
          $match: {
            contractId: contract._id,  // Replace with actual unique key
            claimDate: {
              $gte: new Date(new Date().getFullYear(), 0, 1)  // From start of current year
            }
          }
        },
        // Step 2: Group to calculate total claims, isOpen, total amount, and claims for the month and year
        {
          $group: {
            _id: {
              year: { $year: "$claimDate" },
              month: { $month: "$claimDate" }
            },
            totalClaims: { $sum: 1 },
            isOpen: {
              $max: {
                $cond: [{ $eq: ["$claimFile", "open"] }, true, false]
              }
            },
            totalClaimAmount: { $sum: "$totalAmount" },
            monthClaims: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $year: "$claimDate" }, new Date().getFullYear()] },
                      { $eq: [{ $month: "$claimDate" }, new Date().getMonth() + 1] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            yearClaims: {
              $sum: {
                $cond: [
                  { $eq: [{ $year: "$claimDate" }, new Date().getFullYear()] },
                  1,
                  0
                ]
              }
            },
            docs: { $push: "$$ROOT" }
          }
        },
        // Step 3: Project all data including totalClaims, isOpen, totalClaimAmount, monthClaims, and yearClaims
        {
          $project: {
            _id: 0,  // Exclude the _id field
            year: "$_id.year",
            month: "$_id.month",
            totalClaims: 1,
            isOpen: 1,
            totalClaimAmount: 1,
            monthClaims: 1,
            yearClaims: 1,
            docs: 1
          }
        }
      ]
      checkClaim = await claimService.getClaimWithAggregate(claimQuery)
      if (checkClaim[0].isOpen || checkClaim[0].totalClaims >= contract.noOfClaimPerPeriod || checkClaim[0].monthClaims >= contract.noOfClaim.value || checkClaim[0].monthClaims >= contract.noOfClaim) {
        let updateEligibility = await contractService.updateContract({ _id: contract._id }, { isEligible: false }, { new: true })
      } else if (minDate > newDate) {
        let updateEligibility = await contractService.updateContract({ _id: contract._id }, { isEligible: false }, { new: true })
      } else if (!contract.isManufacturerWarranty) {
        if (contract.labourWarranty < new Date() || contractService.partsWarranty < new Date()) {
          let updateEligibility = await contractService.updateContract({ _id: contract._id }, { isEligible: true }, { new: true })
        }
      } else {
        let updateEligibility = await contractService.updateContract({ _id: contract._id }, { isEligible: true }, { new: true })

      }

    }
    return { code: 200, message: "Success" }

    // res.send({
    //   claimKeysToCheck: checkClaim,
    //   dealerSettings,
    //   getOrderContract,
    //   getOrder
    // })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// Setting Function
exports.saveDealerSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    const adminSetting = await userService.getSetting({ userId: req.userId });

    let dealerId = req.body.dealerId;
    let data = req.body;
    data.setDefault = 0;
    data.userId = dealerId
    data.whiteLabelLogo = adminSetting[0]?.whiteLabelLogo

    // console.log("response===================",data);

    // return;

    // data.logoLight = data.logoLight ? data.logoLight : adminSetting[0]?.logoLight
    // data.logoDark = data.logoDark ? data.logoDark : adminSetting[0]?.logoDark
    // data.favIcon = data.favIcon ? data.favIcon : adminSetting[0]?.favIcon
    let response;
    const getData = await userService.getSetting({ userId: dealerId });
    if (getData.length > 0) {

      response = await userService.updateSetting({ _id: getData[0]?._id }, data, { new: true })
      console.log("dsfsfdsffsd", response);
    }
    else {
      data.title = adminSetting[0]?.title
      data.paymentDetail = adminSetting[0]?.paymentDetail
      data.address = adminSetting[0]?.address
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
exports.resetDealerSetting = async (req, res) => {
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
    const adminSetting = await userService.getSetting({ userId: req.userId });

    let dealerId = req.body.id
    if (req.role == "Dealer") {
      dealerId = req.userId
    }
    if (req.role == "Reseller") {
      const checkReseller = await resellerService.getReseller({ _id: req.userId })
      dealerId = checkReseller.dealerId
    }
    if (req.role == "Customer") {
      const checkCustomer = await customerService.getCustomerById({ _id: req.userId })
      dealerId = checkCustomer.dealerId
    }
    let response;
    const getData = await userService.getSetting({ userId: dealerId });
    response = await userService.updateSetting({ _id: getData[0]?._id }, {
      colorScheme: [],
      defaultColor: [],
      logoLight: {
        fileName: adminSetting[0].logoLight.fileName,
        name: adminSetting[0].logoLight.name,
        size: adminSetting[0].logoLight.size
      },
      logoDark: {
        fileName: adminSetting[0].logoDark.fileName,
        name: adminSetting[0].logoDark.name,
        size: adminSetting[0].logoDark.size
      },
      favIcon: {
        fileName: adminSetting[0].favIcon.fileName,
        name: adminSetting[0].favIcon.name,
        size: adminSetting[0].favIcon.size
      },
      title: adminSetting[0]?.title,
      address: adminSetting[0]?.address,
      paymentDetail: adminSetting[0]?.paymentDetail,
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
exports.defaultSettingDealer = async (req, res) => {
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
    let dealerId = req.params.dealerId
    if (req.role == "Dealer") {
      dealerId = req.userId
    }
    if (req.role == "Reseller") {
      const checkReseller = await resellerService.getReseller({ _id: req.userId })
      dealerId = checkReseller.dealerId
    }
    if (req.role == "Customer") {
      const checkCustomer = await customerService.getCustomerById({ _id: req.userId })
      dealerId = checkCustomer.dealerId
    }
    let getData;
    let dealerSetting = await userService.getSetting({ userId: dealerId });
    if (dealerSetting.length > 0) {
      getData = dealerSetting
    }
    else {
      getData = await userService.getSetting({ userId: req.userId });

    }

    response = await userService.updateSetting({ _id: getData[0]?._id },
      {
        defaultColor: getData[0].colorScheme,
        setDefault: 1,
        defaultAddress: getData[0].address,
        defaultLightLogo: getData[0].logoLight,
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

//Get Dealer Setting
exports.getDealerColorSetting = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action!"
    //   });
    //   return
    // }
    let dealerId = req.params.dealerId
    if (req.role == "Dealer") {
      dealerId = req.userId
    }
    if (req.role == "Reseller") {
      const checkReseller = await resellerService.getReseller({ _id: req.userId })
      dealerId = checkReseller.dealerId
    }
    if (req.role == "Customer") {
      const checkCustomer = await customerService.getCustomerById({ _id: req.userId })
      dealerId = checkCustomer.dealerId
    }
    let setting = await userService.getSetting({ userId: dealerId });
    if (!setting[0] || setting[0].colorScheme.length == 0) {
      setting = await userService.getSetting({});
    }
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