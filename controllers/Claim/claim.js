require("dotenv").config();
const path = require("path");
const { comments } = require("../../models/Claim/comment");
const LOG = require('../../models/User/logs')
const claimService = require("../../services/Claim/claimService");
const orderService = require("../../services/Order/orderService");
const userService = require("../../services/User/userService");
const contractService = require("../../services/Contract/contractService");
const servicerService = require("../../services/Provider/providerService");
const optionService = require("../../services/User/optionsService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const customerService = require("../../services/Customer/customerService");
const providerService = require("../../services/Provider/providerService");
const resellerService = require("../../services/Dealer/resellerService");
const dealerService = require("../../services/Dealer/dealerService");
const supportingFunction = require('../../config/supportingFunction')
let dealerController = require("../../controllers/Dealer/dealerController")
const jwt = require("jsonwebtoken");
const emailConstant = require('../../config/emailConstant');
const constant = require("../../config/constant");
const sgMail = require('@sendgrid/mail');
const moment = require("moment");
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require("multer");
const { default: mongoose } = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs");
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const { default: axios } = require("axios");

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

const folderName = 'claimFile'; // Replace with your specific folder name

const StorageP = multerS3({
  s3: s3,
  bucket: process.env.bucket_name,
  metadata: (req, file, cb) => {
    console.log(" process.env.bucket_name", process.env.bucket_name)
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

var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single("file");

// search claim api  -- not using
exports.searchClaim = async (req, res, next) => {
  try {
    let data = req.body
    let lookupCondition = [{ isDeleted: false }]
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let orderIds = []
    let orderAndCondition = []
    let userSearchCheck = 0
    let customerIds = []
    let checkCustomer = 0
    let contractFilter;

    // query on the bases of payload
    if (data.customerName != "") {
      userSearchCheck = 1
      let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        customerIds = await getData.map(customer => customer._id)
      } else {
        customerIds.push("1111121ccf9d400000000000")
      }
    };
    if (req.role == 'Dealer') {
      userSearchCheck = 1
      orderAndCondition.push({ dealerId: { $in: [req.userId] } })
    }
    if (req.role == 'Reseller') {
      userSearchCheck = 1
      orderAndCondition.push({ resellerId: { $in: [req.userId] } })
    }
    if (req.role == 'Customer') {
      userSearchCheck = 1
      orderAndCondition.push({ customerId: { $in: [req.userId] } })
    }
    if (customerIds.length > 0) {
      orderAndCondition.push({ customerId: { $in: customerIds } })
    }
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order._id)
      }
      else {
        orderIds.push("1111121ccf9d400000000000")
      }
    }
    if (data.contractId != "") {
      data.contractId = data.contractId.replace(/-/g, '')
    }


    if (userSearchCheck == 1) {
      contractFilter = [
        { orderId: { $in: orderIds } },
        { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { "orderUniqueKey": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'serial': { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'unique_key_search': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
        { status: 'Active' },
        { eligibilty: true },
        // { claimFile: "completed" }
      ]
    } else {
      contractFilter = [
        { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { "orderUniqueKey": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'serial': { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'unique_key_search': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
        { status: 'Active' },
        // { claimFile: "completed" },
        { eligibilty: true }
      ]
    }

    let query = [
      {
        $match:
        {
          $and: contractFilter
        },
      },
      {
        $facet: {
          totalRecords: [
            {
              $count: "total"
            }
          ],
          data: [
            {
              $skip: skipLimit
            },
            {
              $limit: pageLimit
            },
            {
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
                pipeline: [
                  {
                    $lookup: {
                      from: "customers",
                      localField: "customerId",
                      foreignField: "_id",
                      as: "customers",
                    }
                  },
                  { $unwind: "$customers" },
                ]

              }
            },
            {
              $unwind: "$order"
            },
            {
              $project: {
                unique_key: 1,
                serial: 1,
                orderId: 1,
                "order.customers.username": 1,
                "order.unique_key": 1,
                "order.venderOrder": 1,
              }
            }
          ]
        }
      },
    ]

    let getContracts = await contractService.getAllContracts2(query)
    let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

    res.send({
      code: constant.successCode,
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      totalCount
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
        const wb = XLSX.read(data.Body, {
          type: 'buffer',
          cellDates: true,
          cellNF: false,
          cellText: false
        });
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

//upload receipt data for claim
exports.uploadReceipt = async (req, res, next) => {
  try {
    uploadP(req, res, async (err) => {


      let file = req.files;
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

//upload comment image data in claim
exports.uploadCommentImage = async (req, res, next) => {
  try {
    imageUpload(req, res, async (err) => {
      let file = req.file;
      res.send({
        code: constant.successCode,
        message: 'Success!',
        messageFile: {
          fileName: file.key,
          originalName: file.originalname,
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
    return
  }

}

//add claim 
exports.addClaim = async (req, res, next) => {
  try {
    let data = req.body;

    let checkContract = await contractService.getContractById({ _id: data.contractId })
    // data.lossDate = new Date(data.lossDate).setDate(new Date(data.lossDate).getDate() + 1)
    // data.lossDate = new Date(data.lossDate)
    const submittedUser = await userService.getUserById1({ _id: data.submittedBy }, {})
    data.submittedBy = submittedUser?.email || ''
    data.shippingTo = data.shippingTo || ''
    if (!checkContract) {
      res.send({
        code: constant.errorCode,
        message: "Contract not found!"
      })
      return;
    }

    if (data.servicerId) {
      let checkServicer = await servicerService.getServiceProviderById({
        $or: [
          { _id: data.servicerId },
          { resellerId: data.servicerId },
          { dealerId: data.servicerId },

        ]
      })

      if (!checkServicer) {
        res.send({
          code: constant.errorCode,
          message: "Servicer not found!"
        })
        return;
      }
    }

    let checkCoverageStartDate = new Date(checkContract.coverageStartDate).setHours(0, 0, 0, 0)
    if (new Date(checkCoverageStartDate) > new Date(data.lossDate)) {
      res.send({
        code: constant.errorCode,
        message: 'Loss date should be in between coverage start date and present date!'
      });
      return;
    }

    if (checkContract.status != 'Active') {
      res.send({
        code: constant.errorCode,
        message: 'The contract is not active!'
      });
      return;
    }

    let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'open' })
    if (checkClaim) {
      res.send({
        code: constant.errorCode,
        message: 'The previous claim is still open!'
      });
      return
    }

    const query = { contractId: new mongoose.Types.ObjectId(data.contractId) }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]

    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);

    let remainingPrice = checkContract.productValue - claimTotal[0]?.amount
    if (data.coverageType != "") {
      let checkCoverageTypeForContract = checkContract.coverageType.find(item => item.value == data.coverageType)
      if (!checkCoverageTypeForContract) {
        res.send({
          code: constant.errorCode,
          message: 'Coverage type is not available for this contract!'
        })
        return;
      }
      let startDateToCheck = new Date(checkContract.coverageStartDate)
      let coverageTypeDays = checkContract.adhDays
      let serviceCoverageType = checkContract.serviceCoverageType

      let getDeductible = coverageTypeDays.filter(coverageType => coverageType.value == data.coverageType)

      let checkCoverageTypeDate = startDateToCheck.setDate(startDateToCheck.getDate() + Number(getDeductible[0].waitingDays))

      let getCoverageTypeFromOption = await optionService.getOption({ name: "coverage_type" })

      const result = getCoverageTypeFromOption.value.filter(item => item.value === data.coverageType).map(item => item.label);
      checkCoverageTypeDate = new Date(checkCoverageTypeDate).setHours(0, 0, 0, 0)
      data.lossDate = new Date(data.lossDate).setHours(0, 0, 0, 0)
      if (new Date(checkCoverageTypeDate) > new Date(data.lossDate)) {
        // claim not allowed for that coverageType
        res.send({
          code: 403,
          tittle: `Claim not eligible for ${result[0]}.`,
          // message: `Your selected ${result[0]} is currently not eligible for the claim. You can file the claim for ${result[0]} on ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}. Do you wish to proceed in rejecting this claim?`
          message: `Your claim for ${result[0]} cannot be filed because it is not eligible based on the loss date. You will be able to file this claim starting on ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}`
        })
        return

      }

    }

    data.receiptImage = data.file
    data.servicerId = data.servicerId ? data.servicerId : null

    const checkOrder = await orderService.getOrder({ _id: checkContract.orderId }, { isDeleted: false })
    let currentYear = new Date().getFullYear();
    currentYear = "-" + currentYear + "-"
    let count = await claimService.getClaimCount({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });

    data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
    data.unique_key_search = "CC" + currentYear + data.unique_key_number
    data.unique_key = "CC" + currentYear + data.unique_key_number
    data.orderId = checkOrder.unique_key
    data.venderOrder = checkOrder.venderOrder
    data.serial = checkContract.serial
    data.dealerSku = checkContract.dealerSku
    data.productName = checkContract.productName
    data.pName = checkContract?.pName
    data.dealerId = checkOrder.dealerId
    data.resellerId = checkOrder?.resellerId
    data.customerId = checkOrder.customerId
    data.model = checkContract.model
    data.manufacture = checkContract.manufacture
    data.serialNumber = checkContract.serial
    data.claimType = data.coverageType

    let claimResponse = await claimService.createClaim(data)
    if (!claimResponse) {
      let logData = {
        userId: req.userId,
        endpoint: "addClaim",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to add claim of this contract!",
          result: claimResponse
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to add claim of this contract!'
      });
      return
    }

    // Eligibility false when claim open
    const updateContract = await contractService.updateContract({ _id: data.contractId }, { eligibilty: false }, { new: true })

    //Save logs add claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/addClaim",
      body: data,
      response: {
        code: constant.successCode,
        message: 'Success!',
        result: claimResponse
      }
    }

    await LOG(logData).save()

    //Send notification to all
    let notificationArray = []
    //Get Dealer,reseller, customer status
    const checkDealer = await dealerService.getDealerById(checkOrder.dealerId)
    const checkReseller = await resellerService.getReseller({ _id: checkOrder?.resellerId }, {})
    const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId })
    //Get submitted user
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const site_url = `${process.env.SITE_URL}`

    const checkServicer = await servicerService.getServiceProviderById({ $or: [{ _id: data?.servicerId }, { dealerId: data?.servicerId }, { resellerId: data?.servicerId }] })
    const adminAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.newClaim": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
              ]
            },
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminAddClaimQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    if (adminUsers.length > 0) {
      let notificationAdmin = {
        title: "Claim Filed Successfully",
        description: `A new claim # ${claimResponse.unique_key} for dealer ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: claimResponse._id,
        flag: 'claim',
        notificationFor: IDs,
        endPoint: site_url + "claim-listing/" + claimResponse.unique_key,
        redirectionId: "claim-listing/" + claimResponse.unique_key,
      };
      notificationArray.push(notificationAdmin)
    }

    //Dealer Notification
    const dealerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.newClaim": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.dealerId },
              ]
            },
          ]
        }
      },
    }
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerAddClaimQuery, { email: 1 })
    const dealerIds = dealerUsers.map(user => user._id)
    if (dealerUsers.length > 0) {
      let notificationDealer = {
        title: "Claim Filed Successfully",
        description: `A new claim # ${claimResponse.unique_key} for customer ${checkCustomer.username} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: claimResponse._id,
        flag: 'claim',
        notificationFor: dealerIds,
        endPoint: site_url + "claim-listing/" + claimResponse.unique_key,
        redirectionId: "claim-listing/" + claimResponse.unique_key,
      };
      notificationArray.push(notificationDealer)
    }

    //Reseller Notification
    const resellerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.newClaim": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.resellerId },
                // { metaId: data?.servicerId },
              ]
            },
          ]
        }
      },
    }
    let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerAddClaimQuery, { email: 1 })
    const resellerIds = resellerUsers.map(user => user._id)

    if (resellerUsers.length > 0) {
      let notificationReseller = {
        title: "Claim Filed Successfully",
        description: `A new claim # ${claimResponse.unique_key} for customer ${checkCustomer.username} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: claimResponse._id,
        flag: 'claim',
        notificationFor: resellerIds,
        endPoint: site_url + "claim-listing/" + claimResponse.unique_key,
        redirectionId: "claim-listing/" + claimResponse.unique_key,
      };
      notificationArray.push(notificationReseller)
    }

    //Customer Notification
    const customerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.newClaim": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.customerId },
                // { metaId: checkOrder.resellerId },
                // { metaId: data?.servicerId },
              ]
            },
          ]
        }
      },
    }
    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerAddClaimQuery, { email: 1 })
    const customerIds = customerUsers.map(user => user._id)
    if (customerUsers.length > 0) {
      let notificationCustomer = {
        title: "Claim Filed Successfully",
        description: `A new claim # ${claimResponse.unique_key}  has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: claimResponse._id,
        flag: 'claim',
        notificationFor: customerIds,
        endPoint: site_url + "claim-listing/" + claimResponse.unique_key,
        redirectionId: "claim-listing/" + claimResponse.unique_key,
      };
      notificationArray.push(notificationCustomer)
    }

    //Servicer Notification
    const servicerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.newClaim": true },
            { status: true },
            {
              $or: [
                { metaId: data?.servicerId },
              ]
            },
          ]
        }
      },
    }
    let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerAddClaimQuery, { email: 1 })
    const servicerIds = servicerUsers.map(user => user._id)
    if (servicerUsers.length > 0) {
      let notificationServicer = {
        title: "Claim Filed Successfully",
        description: `A new claim # ${claimResponse.unique_key} for dealer ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
        userId: req.teammateId,
        contentId: claimResponse._id,
        flag: 'claim',
        notificationFor: servicerIds,
        endPoint: site_url + "claim-listing/" + claimResponse.unique_key,
        redirectionId: "claim-listing/" + claimResponse.unique_key,
      };
      notificationArray.push(notificationServicer)
    }

    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
    let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
    let servicerPrimary = await supportingFunction.getPrimaryUser({ $or: [{ metaData: { $elemMatch: { metaId: data?.servicerId, isPrimary: true } } }, { metaData: { $elemMatch: { metaId: checkServicer?.dealerId, isPrimary: true } } }, { metaData: { $elemMatch: { metaId: checkServicer?.resellerId, isPrimary: true } } }] })

    let createNotification = await userService.saveNotificationBulk(notificationArray);

    // Send Email code here
    let settingData = await userService.getSetting({});
    let adminCC = await supportingFunction.getUserEmails();
    const base_url = `${process.env.SITE_URL}claim-listing/${claimResponse.unique_key}`

    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: `Dear ${customerPrimary.metaData[0]?.firstName}`,
      redirectId: base_url
    }
    let mailing;
    if (checkCustomer.isAccountCreate) {
      const customerCaseNotification = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.newClaim": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                  { metaId: checkOrder.dealerId },
                  { metaId: checkOrder.customerId },
                  { metaId: checkOrder.resellerId },
                ]
              },

            ]
          }
        },
      }

      let customerCaseUser = await supportingFunction.getNotificationEligibleUser(customerCaseNotification, { email: 1, metaData: 1 })
      let adminUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.super_admin.toString())
      let dealerUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.dealer.toString())
      let resellerUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.reseller.toString())
      let customerUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.customer.toString())

      const adminEmail = adminUser.map(user => user.email)
      const dealerEmail = dealerUser.map(user => user.email)
      const resellerEmail = resellerUser.map(user => user.email)
      const customerEmail = customerUser.map(user => user.email)

      emailData.subject = `Claim Received -${claimResponse.unique_key}`
      emailData.content = `The Claim # ${claimResponse.unique_key} has been successfully filed for the Contract # ${checkContract.unique_key}. We have informed the repair center also. You can view the progress of the claim here :`
      emailData.senderName = `Dear Admin`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(adminEmail, ["noreply@getcover.com"], emailData))
      emailData.senderName = `Dear ${dealerPrimary.metaData[0]?.firstName}`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
      emailData.senderName = `Dear ${resellerPrimary.metaData[0]?.firstName}`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], emailData))
      emailData.senderName = `Dear ${customerPrimary.metaData[0]?.firstName}`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(customerEmail, ["noreply@getcover.com"], emailData))
    }
    else {
      const customerCaseNotification = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.newClaim": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                  { metaId: checkOrder.dealerId },
                  { metaId: checkOrder?.resellerId ? checkOrder?.resellerId : "000008041eb1acda24111111" },
                ]
              },

            ]
          }
        },
      }
      let customerCaseUser = await supportingFunction.getNotificationEligibleUser(customerCaseNotification, { email: 1, metaData: 1 })

      let adminUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.super_admin.toString())
      let dealerUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.dealer.toString())
      let resellerUser = customerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.reseller.toString())
      const adminEmail = adminUser.map(user => user.email)
      const dealerEmail = dealerUser.map(user => user.email)
      const resellerEmail = resellerUser.map(user => user.email)

      emailData.subject = `Claim Received - ${claimResponse.unique_key}`
      emailData.content = `The Claim # ${claimResponse.unique_key} has been successfully filed for the Contract #  ${checkContract.unique_key}. We have informed the repair center also. You can view the progress of the claim here :`
      emailData.senderName = `Dear Admin`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(adminEmail, ["noreply@getcover.com"], emailData))
      emailData.senderName = `Dear ${dealerPrimary.metaData[0]?.firstName}`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
      emailData.senderName = `Dear ${resellerPrimary.metaData[0]?.firstName}`
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], emailData))
    }
    // Email to servicer and cc to admin 
    if (servicerPrimary) {
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        model: checkContract.model,
        serial: checkContract.serial,
        manufacturer: checkContract.manufacture,
        redirectId: base_url
      }
      if (checkServicer?.isAccountCreate) {
        const servicerCaseNotification = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.newClaim": true },
                { status: true },
                {
                  $or: [
                    { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                    { metaId: checkServicer._id },
                  ]
                },

              ]
            }
          },
        }
        let servicerCaseUser = await supportingFunction.getNotificationEligibleUser(servicerCaseNotification, { email: 1, metaData: 1 })
        let adminUser = servicerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.super_admin.toString())
        let servicerUser = servicerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.servicer.toString())
        const adminEmail = adminUser.map(user => user.email)
        const servicerEmail = servicerUser.map(user => user.email)
        let notificationAdmin = await supportingFunction.getUserEmails();
        emailData.subject = `New Device Received for Repair - ID: ${claimResponse.unique_key}`
        emailData.content = `We want to inform you that ${checkCustomer.username} has requested for the repair of a device detailed below:`
        // emailData.senderName = "Admin"
        // mailing = sgMail.send(emailConstant.sendServicerClaimNotification(adminEmail, ["noreply@getcover.com"], emailData))
        emailData.senderName = servicerPrimary?.metaData[0]?.firstName
        mailing = sgMail.send(emailConstant.sendServicerClaimNotification(servicerEmail, ["noreply@getcover.com"], emailData))
      }

    }
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: claimResponse
    })

  }
  catch (err) {
    //Save logs add claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/addClaim",
      body: req.body ? req.body : { 'type': "Catch" },
      response: {
        code: constant.errorCode,
        message: err.message,
        stack: err.stack
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message,
    })
  }
}

// Edit Repair part Done
exports.editClaim = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.claimId }

    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    if (checkClaim.claimFile == 'open') {
      let contract = await contractService.getContractById({ _id: checkClaim.contractId });
      const query = { contractId: new mongoose.Types.ObjectId(checkClaim.contractId), claimFile: 'completed' }
      let claimTotalQuery = [
        { $match: query },
        { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

      ]
      let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
      if (claimTotal.length > 0) {
        const remainingValue = contract.productValue - claimTotal[0]?.amount
        // if (remainingValue.toFixed(2) < data.totalAmount) {
        //   res.send({
        //     code: constant.errorCode,
        //     message: 'Claim Amount Exceeds Contract Retail Price'
        //   });
        //   return;
        // }
      }
      // if (contract.productValue < data.totalAmount) {
      //   res.send({
      //     code: constant.errorCode,
      //     message: 'Claim Amount Exceeds Contract Retail Price'
      //   });
      //   return;
      // }
      let option = { new: true }
      let updateData = await claimService.updateClaim(criteria, data, option)
      if (!updateData) {
        //Save Logs edit claim
        let logData = {
          userId: req.userId,
          endpoint: "claim/editClaim",
          body: data,
          response: {
            code: constant.errorCode,
            message: 'Failed to process your request!',
            result: updateData
          }
        }



        await LOG(logData).save()
        res.send({
          code: constant.errorCode,
          message: "Failed to process your request."
        })
        return;
      }
      let udpateclaimAmount = await axios.get(process.env.API_ENDPOINT + "api-v1/claim/checkClaimAmount/" + updateData._id, {
        headers: {
          "x-access-token": req.header["x-access-token"],  // Include the token in the Authorization header
        }
      });

      //Send notification to all
      //Get submitted user
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      let notificationArray = []
      const site_url = `${process.env.SITE_URL}`
      const adminEditClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.partsUpdate": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                ]
              },

            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminEditClaimQuery, { email: 1 })
      const IDs = adminUsers.map(user => user._id)
      let servicerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkClaim?.servicerId, isPrimary: true } } })
      //chek servicer status
      const checkServicer = await servicerService.getServiceProviderById({ $or: [{ _id: checkClaim?.servicerId }, { dealerId: checkClaim?.servicerId }, { resellerId: checkClaim?.servicerId }] })
      if (adminUsers.length > 0) {
        let notificationAdmin = {
          title: "Servicer charges added",
          description: `Claim # ${checkClaim.unique_key} - Service charges has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          adminMessage: `Claim # ${checkClaim.unique_key} - Service charges has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          servicerMessage: `Claim # ${checkClaim.unique_key} - Service charges has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
          notificationFor: IDs
        };
        notificationArray.push(notificationAdmin)
      }
      const servicerEditClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.partsUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkClaim?.servicerId },
                ]
              },

            ]
          }
        },
      }
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerEditClaimQuery, { email: 1 })
      const servicerIDs = servicerUsers.map(user => user._id)
      if (servicerUsers.length > 0) {
        let notificationAdmin = {
          title: "Charges added",
          description: `Claim # ${checkClaim.unique_key} - Service charges has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
          notificationFor: servicerIDs
        };
        notificationArray.push(notificationAdmin)
      }
      let createNotification = await userService.saveNotificationBulk(notificationArray);
      //Save Logs edit claim
      let logData = {
        userId: req.userId,
        endpoint: "claim/editClaim",
        body: data,
        response: {
          code: constant.successCode,
          message: 'Updated successfully',
          result: updateData
        }
      }
      await LOG(logData).save()
      // Send Email code here
      let notificationEmails = adminUsers.map(user => user.email)
      let servicerEmails = servicerUsers.map(user => user.email)
      let mergedEmail = notificationEmails.concat(servicerEmails)
      let settingData = await userService.getSetting({});
      const base_url = `${process.env.SITE_URL}claim-listing/${checkClaim.unique_key}`
      const lastElement = data.repairParts.pop();
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: `Dear ${servicerPrimary ? servicerPrimary.metaData[0]?.firstName : ''}`,
        redirectId: base_url,
        content: `We would like to inform you that the repair information for Claim ID  ${checkClaim.unique_key} has been successfully updated in our system. Please review the updated details and proceed accordingly.`,
        subject: `Update on Repair Information for Claim  ID ${checkClaim.unique_key}`
      }
      emailData.senderName = "Dear Admin"
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
      emailData.senderName = servicerPrimary ? servicerPrimary.metaData[0]?.firstName : '',
        mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmails, ["noreply@getcover.com"], emailData))


      let totalClaimQuery1 = [
        {
          $match: {
            contractId: new mongoose.Types.ObjectId(checkClaim.contractId)
          }
        },
        {
          $group: {
            _id: null,            // Group by null to aggregate over all documents
            totalAmount: { $sum: "$totalAmount" }  // Sum the 'amount' field
          }
        }
      ]
      let getClaims = await claimService.getClaimWithAggregate(totalClaimQuery1)
      let updateTheContract = await contractService.updateContract({ _id: checkClaim.contractId }, { claimAmount: getClaims[0] ? getClaims[0].totalAmount : 0 }, { new: true })
      res.send({
        code: constant.successCode,
        message: "Updated successfully"
      })
      return;
    }
    let totalClaimQuery1 = [
      {
        $match: {
          contractId: new mongoose.Types.ObjectId(checkClaim.contractId)
        }
      },
      {
        $group: {
          _id: null,            // Group by null to aggregate over all documents
          totalAmount: { $sum: "$totalAmount" }  // Sum the 'amount' field
        }
      }
    ]
    let getClaims = await claimService.getClaimWithAggregate(totalClaimQuery1)
    let updateTheContract = await contractService.updateContract({ _id: checkClaim._id }, { claimAmount: getClaims[0] ? getClaims[0].totalAmount : 0 }, { new: true })
    console.log("updated contract ak", getClaims, updateTheContract.claimAmount)

    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })

  } catch (err) {
    //Save Logs edit claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaim catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//edit claim type api
exports.editClaimType = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.claimId }

    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }

    if (checkClaim.claimFile == 'open') {
      if (data.claimType == "theft_and_lost") {
        data.servicerId = null
      }
      let option = { new: true }

      let updateData = await claimService.updateClaim(criteria, data, option)
      if (!updateData) {
        //Save logs 
        let logData = {
          userId: req.userId,
          endpoint: "claim/editClaimType",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Failed to process your request.",
            result: updateData
          }
        }
        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Failed to process your request."
        })
        return;
      }

      //Save logs 
      let logData = {
        userId: req.userId,
        endpoint: "claim/editClaimType",
        body: data,
        response: {
          code: constant.successCode,
          message: "Updated successfully",
          result: updateData
        }
      }
      await LOG(logData).save()
      if (updateData.claimType != "" || updateData.claimType != "New") {
        console.log("checking ak ++++++++++++++++++++++++++", req.header)
        let udpateclaimAmount = await axios.get(process.env.API_ENDPOINT + "api-v1/claim/checkClaimAmount/" + updateData._id, {
          headers: {
            "x-access-token": req.header["x-access-token"],  // Include the token in the Authorization header
          }
        });
        console.log("updated data +++++++++++++++++++++++++++++++++++", udpateclaimAmount)
      }
      let checkUpdatedClaim = await claimService.getClaimById(criteria)

      res.send({
        code: constant.successCode,
        result: checkUpdatedClaim,
        message: "Updated successfully",
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })

  } catch (err) {
    // Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimType catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// Claim Paid and unpaid api Done
exports.editClaimStatus = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.claimId }
    let settingData = await userService.getSetting({});

    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    const base_url = `${process.env.SITE_URL}claim-listing/${checkClaim.unique_key}`

    const query = { contractId: new mongoose.Types.ObjectId(checkClaim.contractId) }
    let checkContract = await contractService.getContractById({ _id: checkClaim.contractId })
    const checkOrder = await orderService.getOrder({ _id: checkContract.orderId }, { isDeleted: false })
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);

    let status = {};
    let updateData = {};

    //Get Dealer,reseller, customer status
    const checkDealer = await dealerService.getDealerById(checkOrder.dealerId)
    const checkReseller = await resellerService.getReseller({ _id: checkOrder?.resellerId }, {})
    const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId })
    const checkServicer = await servicerService.getServiceProviderById({ $or: [{ _id: checkClaim?.servicerId }, { dealerId: checkClaim?.servicerId }, { resellerId: checkClaim?.servicerId }] })


    if (data.hasOwnProperty("customerStatus")) {

      //Get submitted user
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const site_url = `${process.env.SITE_URL}`
      const checkCustomerStatus = await optionService.getOption({ name: "customer_status" })
      const matchedData = checkCustomerStatus?.value.find(status => status.value == data.customerStatus)
      if (data.customerStatus == 'product_received') {
        let option = { new: true }
        let claimStatus = await claimService.updateClaim(criteria, { claimFile: 'completed', claimDate: new Date() }, option)
        updateData.claimStatus = [
          {
            status: 'completed',
            date: new Date()
          }
        ]
        status.trackStatus = [
          {
            status: 'completed',
            date: new Date()
          }
        ]
        let statusClaim = await claimService.updateClaim(criteria, { updateData }, { new: true })
      }

      updateData.customerStatus = [
        {
          status: data.customerStatus,
          date: new Date()
        }
      ]

      status.trackStatus = [
        {
          status: data.customerStatus,
          date: new Date()
        }
      ]

      //Send notification to all
      let notificationArray = []
      const adminCustomerStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.customerStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                ]
              },

            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminCustomerStatusUpdateQuery, { email: 1 })
      const IDs = adminUsers.map(user => user._id)
      if (adminUsers.length > 0) {
        let notificationAdmin = {
          title: "Claim Customer Status Updated",
          description: `Claim # ${checkClaim.unique_key} customer status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          notificationFor: IDs,
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
        };
        notificationArray.push(notificationAdmin)
      }

      //Dealer Notification
      const dealerAddClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.customerStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder.dealerId },
                ]
              },
            ]
          }
        },
      }

      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerAddClaimQuery, { email: 1 })
      const dealerIds = dealerUsers.map(user => user._id)
      if (dealerUsers.length > 0) {
        let notificationDealer = {
          title: "Claim Customer Status Updated",
          description: `Claim # ${checkClaim.unique_key} customer status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          notificationFor: dealerIds,
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
        };
        notificationArray.push(notificationDealer)
      }
      //Reseller Notification
      const resellerAddClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.customerStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder.resellerId },
                ]
              },
            ]
          }
        },
      }
      let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerAddClaimQuery, { email: 1 })
      const resellerIds = resellerUsers.map(user => user._id)

      if (resellerUsers.length > 0) {
        let notificationReseller = {
          title: "Claim Customer Status Updated",
          description: `Claim # ${checkClaim.unique_key} customer status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          notificationFor: resellerIds,
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
        };
        notificationArray.push(notificationReseller)
      }

      //Customer Notification
      const customerAddClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.customerStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder.customerId },

                ]
              },
            ]
          }
        },
      }
      let customerUsers = await supportingFunction.getNotificationEligibleUser(customerAddClaimQuery, { email: 1 })
      const customerIds = customerUsers.map(user => user._id)
      if (customerUsers.length > 0) {
        let notificationCustomer = {
          title: "Claim Customer Status Updated",
          description: `Claim # ${checkClaim.unique_key} customer status has been updated to ${matchedData?.label}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          notificationFor: customerIds,
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
        };
        notificationArray.push(notificationCustomer)
      }
      const servicerAddClaimQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.customerStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkClaim?.servicerId },
                ]
              },
            ]
          }
        },
      }
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerAddClaimQuery, { email: 1 })
      const servicerIds = servicerUsers.map(user => user._id)
      if (servicerUsers.length > 0) {
        let notificationServicer = {
          title: "Claim Customer Status Updated",
          description: `Claim # ${checkClaim.unique_key} customer status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          notificationFor: servicerIds,
          endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
          redirectionId: "claim-listing/" + checkClaim.unique_key,
        };
        notificationArray.push(notificationServicer)
      }
      let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
      let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkClaim?.servicerId, isPrimary: true } } })


      let createNotification = await userService.saveNotificationBulk(notificationArray);
      // Send Email code here

      let adminEmail = adminUsers.map(user => user.email)
      let dealerEmail = dealerUsers.map(user => user.email)
      let customerEmail = customerUsers.map(user => user.email)
      let resellerEmail = resellerUsers.map(user => user.email)
      let servicerEmail = servicerUsers.map(user => user.email)
      const base_url = `${process.env.SITE_URL}claim-listing/${checkClaim.unique_key}`

      //Email to customer
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: '',
        content: `The Customer Status has been updated on the claim # ${checkClaim.unique_key} to be ${matchedData?.label}. Please review the information on the following url.`,
        subject: `Customer Status Updated for ${checkClaim.unique_key}`,
        redirectId: base_url
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(adminEmail, ["noreply@getcover.com"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(customerEmail, ["noreply@getcover.com"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, ["noreply@getcover.com"], emailData))

    }
    if (data.hasOwnProperty("repairStatus")) {
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const site_url = `${process.env.SITE_URL}`
      let notificationArray = []
      const checkRepairStatus = await optionService.getOption({ name: "repair_status" })
      const matchedData = checkRepairStatus?.value.find(status => status.value == data.repairStatus)
      status.trackStatus = [
        {
          status: data.repairStatus,
          date: new Date()
        }
      ]

      updateData.repairStatus = [
        {
          status: data.repairStatus,
          date: new Date()
        }
      ]
      //Send notification to all
      const adminRepairStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.repairStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                ]
              },

            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminRepairStatusUpdateQuery, { email: 1 })
      const IDs = adminUsers.map(user => user._id)
      if (adminUsers.length > 0) {
        //Get submitted user
        let notificationAdmin = {
          title: "Claim Repair Status Updated",
          description: `Claim # ${checkClaim.unique_key} repair status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,


          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: IDs
        };
        notificationArray.push(notificationAdmin)
      }
      const dealerRepairStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.repairStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: new mongoose.Types.ObjectId(checkOrder.dealerId) },
                ]
              },

            ]
          }
        },
      }
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerRepairStatusUpdateQuery, { email: 1 })

      const dealerids = dealerUsers.map(user => user._id)
      if (dealerUsers.length > 0) {
        //Get submitted user
        let notificationAdmin = {
          title: "Claim Repair Status Updated",
          description: `Claim # ${checkClaim.unique_key} repair status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: dealerids
        };
        notificationArray.push(notificationAdmin)
      }
      const resellerRepairStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.repairStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: new mongoose.Types.ObjectId(checkOrder.resellerId) },
                ]
              },

            ]
          }
        },
      }
      let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerRepairStatusUpdateQuery, { email: 1 })

      const reselerids = resellerUsers.map(user => user._id)
      if (resellerUsers.length > 0) {
        //Get submitted user
        let notificationAdmin = {
          title: "Claim Repair Status Updated",
          description: `Claim # ${checkClaim.unique_key} repair status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: reselerids
        };
        notificationArray.push(notificationAdmin)
      }
      const customerRepairStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.repairStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: new mongoose.Types.ObjectId(checkOrder.customerId) },
                ]
              },

            ]
          }
        },
      }
      let customerUsers = await supportingFunction.getNotificationEligibleUser(customerRepairStatusUpdateQuery, { email: 1 })

      const customerids = customerUsers.map(user => user._id)
      if (customerUsers.length > 0) {
        //Get submitted user
        let notificationAdmin = {
          title: "Claim Repair Status Updated",
          description: `Claim # ${checkClaim.unique_key} repair status has been updated to ${matchedData?.label}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: customerids
        };
        notificationArray.push(notificationAdmin)
      }
      const servicerRepairStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.repairStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: new mongoose.Types.ObjectId(checkClaim?.servicerId) },
                ]
              },

            ]
          }
        },
      }
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerRepairStatusUpdateQuery, { email: 1 })

      const servicerids = servicerUsers.map(user => user._id)
      if (servicerUsers.length > 0) {
        //Get submitted user
        let notificationAdmin = {
          title: "Claim Repair Status Updated",
          description: `Claim # ${checkClaim.unique_key} repair status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: servicerids
        };
        notificationArray.push(notificationAdmin)
      }
      let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
      let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkClaim?.servicerId, isPrimary: true } } })

      let createNotification = await userService.saveNotificationBulk(notificationArray);


      // Send Email code here
      let notificationEmails = adminUsers.map(user => user.email)
      let dealerEmail = dealerUsers.map(user => user.email)
      let customerEmail = customerUsers.map(user => user.email)
      let resellerEmail = resellerUsers.map(user => user.email)
      let servicerEmail = servicerUsers.map(user => user.email)

      // Email to Customer
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: ''
        , content: `The Repair Status has been updated on the claim #  ${checkClaim.unique_key} to be ${matchedData?.label} .Please review the information at`,
        subject: `Repair Status Updated for ${checkClaim.unique_key}`,
        redirectId: base_url
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.cover"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.cover"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(customerEmail, ["noreply@getcover.cover"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.cover"], emailData))
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, ["noreply@getcover.cover"], emailData))

    }
    if (data.hasOwnProperty("claimStatus")) {
      let claimStatus = await claimService.updateClaim(criteria, { claimFile: data.claimStatus, reason: data.reason ? data.reason : '' }, { new: true })
      const checkClaimStatus = await optionService.getOption({ name: "claim_status" })

      const matchedData = checkClaimStatus?.value.find(status => status.value == data.claimStatus)

      status.trackStatus = [
        {
          status: data.claimStatus,
          date: new Date()
        }
      ]

      updateData.claimStatus = [
        {
          status: data.claimStatus,
          date: new Date()
        }
      ]

      //Send notification to all
      const adminClaimStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.claimStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },

                ]
              },

            ]
          }
        },
      }
      const dealerClaimStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.claimStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder?.dealerId },
                ]
              },

            ]
          }
        },
      }
      const resellerClaimStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.claimStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder?.resellerId },
                ]
              },

            ]
          }
        },
      }
      const customerClaimStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.claimStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkOrder?.customerId },
                ]
              },

            ]
          }
        },
      }
      const servicerClaimStatusUpdateQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.claimStatusUpdate": true },
              { status: true },
              {
                $or: [
                  { metaId: checkClaim?.servicerId },
                ]
              },

            ]
          }
        },
      }

      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminClaimStatusUpdateQuery, { email: 1 })
      let dealerUser = await supportingFunction.getNotificationEligibleUser(dealerClaimStatusUpdateQuery, { email: 1 })
      let customerUsers = await supportingFunction.getNotificationEligibleUser(customerClaimStatusUpdateQuery, { email: 1 })
      let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerClaimStatusUpdateQuery, { email: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerClaimStatusUpdateQuery, { email: 1 })
      //Get all ids 
      let notificationArray = []
      const IDs = adminUsers.map(user => user._id)
      const dealerIds = dealerUser.map(user => user._id)
      const customerIDs = customerUsers.map(user => user._id)
      const resellerIDs = resellerUsers.map(user => user._id)
      const servicerIDs = servicerUsers.map(user => user._id)

      const admin = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true } } });

      let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
      let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkClaim?.servicerId, isPrimary: true } } })

      //Get submitted user
      const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
      const site_url = `${process.env.SITE_URL}`
      if (adminUsers.length > 0) {
        let notificationData1 = {
          title: "Claim  Status Updated",
          description: `Claim # ${checkClaim.unique_key} claim status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: IDs
        };
        notificationArray.push(notificationData1);
      }
      if (dealerUser.length > 0) {
        let notificationData1 = {
          title: "Claim  Status Updated",
          description: `Claim # ${checkClaim.unique_key} claim status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: dealerIds
        };
        notificationArray.push(notificationData1);
      }
      if (customerUsers.length > 0) {
        let notificationData1 = {
          title: "Claim  Status Updated",
          description: `Claim # ${checkClaim.unique_key} claim status has been updated to ${matchedData?.label}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: customerIDs
        };
        notificationArray.push(notificationData1);
      }
      if (resellerUsers.length > 0) {
        let notificationData1 = {
          title: "Claim  Status Updated",
          description: `Claim # ${checkClaim.unique_key} claim status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: resellerIDs
        };
        notificationArray.push(notificationData1);
      }
      if (servicerUsers.length > 0) {
        let notificationData1 = {
          title: "Claim  Status Updated",
          description: `Claim # ${checkClaim.unique_key} claim status has been updated to ${matchedData?.label} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} `,
          userId: req.teammateId,
          contentId: checkClaim._id,
          flag: 'claim',
          redirectionId: `claim-listing/${checkClaim.unique_key}`,
          endPoint: site_url + `claim-listing/${checkClaim.unique_key}`,
          notificationFor: servicerIDs
        };
        notificationArray.push(notificationData1);
      }
      let createNotification = await userService.saveNotificationBulk(notificationArray);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      if (data.claimStatus == 'rejected') {
        //Send notification to dealer,customer,reseller
        let sendRejectionDealerNotification = dealerUser.map(user => user.email);
        let sendRejectionResellerNotification = resellerUsers.map(user => user.email);
        let sendRejectionCustomerNotification = customerUsers.map(user => user.email);
        let emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: dealerPrimary.metaData[0].firstName,
          content: `We regret to inform you that your claim ID: ${checkClaim.unique_key} has been reviewed and, unfortunately, does not meet the criteria for approval. After careful assessment, the claim has been rejected due to the following reason:`,
          content1: `Reason for Rejection : ${data.reason}`,
          content2: `If you believe there has been an error or if you would like further clarification, please feel free to reach out to our support team at support@getcover.com. Our team is here to assist you with any questions you may have.`,
          subject: `Claim Rejection Notice -Claim ID:  ${checkClaim.unique_key}`
        }
        let mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendRejectionDealerNotification, ["noreply@getcover.com"], emailData))
        emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: customerPrimary.metaData[0].firstName,
          content: `We regret to inform you that your claim ID: ${checkClaim.unique_key} has been reviewed and, unfortunately, does not meet the criteria for approval. After careful assessment, the claim has been rejected due to the following reason:`,
          content1: `Reason for Rejection : ${data.reason}`,
          content2: `If you believe there has been an error or if you would like further clarification, please feel free to reach out to our support team at support@getcover.com. Our team is here to assist you with any questions you may have.`,
          subject: `Claim Rejection Notice -Claim ID:  ${checkClaim.unique_key}`
        }
        mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendRejectionCustomerNotification, ["noreply@getcover.com"], emailData))
        if (resellerPrimary) {// If reseller exist for claim
          emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: resellerPrimary?.metaData[0].firstName,
            content: `We regret to inform you that your claim ID: ${checkClaim.unique_key} has been reviewed and, unfortunately, does not meet the criteria for approval. After careful assessment, the claim has been rejected due to the following reason:`,
            content1: `Reason for Rejection : ${data.reason}`,
            content2: `If you believe there has been an error or if you would like further clarification, please feel free to reach out to our support team at support@getcover.com. Our team is here to assist you with any questions you may have.`,
            subject: `Claim Rejection Notice -Claim ID:  ${checkClaim.unique_key}`
          }
          mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendRejectionResellerNotification, ["noreply@getcover.com"], emailData))
        }

        //Email to Servicer
        const sendRejectionServicerNotification = servicerUsers.map(user => user.email);
        if (servicerPrimary) {
          emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: `${checkServicer.name}`,
            content: `We would like to inform you that Claim ID - ${checkClaim.unique_key} has been rejected, and no further action is needed on your part for this claim. Please halt any ongoing repair work related to this claim immediately`,
            content1: `If you have any questions or require clarification, feel free to contact us`,
            subject: "Claim Update - No Further Action Required"
          }
          mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendRejectionServicerNotification, ["noreply@getcover.com"], emailData))

        }
        //Email to admin
        const sendRejectionAdminNotification = adminUsers.map(user => user.email);
        emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: `Admin`,
          content: `This is to notify you that the claim rejection process for Claim ID - ${checkClaim.unique_key} has been completed successfully. The claim has been marked as rejected, and the customer has been notified with the reason provided`,
          subject: "Action Notification – Claim Rejection Completed"
        }
        mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendRejectionAdminNotification, ['noreply@getcover.com'], emailData))

      }
      if (data.claimStatus == 'completed') {
        //Email to dealer,customer,reseller
        let sendCompletionDealerNotification = dealerUser.map(user => user.email);
        let sendCompletionResellerNotification = resellerUsers.map(user => user.email);
        let sendCompletionCustomerNotification = customerUsers.map(user => user.email);
        let emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: `${checkDealer.name}`,
          content: `We are pleased to inform you that your claim Claim ID: - ${checkClaim.unique_key} has been successfully completed. All necessary repairs or services associated with your claim have been finalized`,
          content1: `If you have any further questions or require additional support, please feel free to contact us at support@getcover.com.`,
          content2: '',
          subject: `Claim Completion Notification – Claim ID:  ${checkClaim.unique_key}`
        }
        let mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendCompletionDealerNotification, ["noreply@getcover.com"], emailData))
        if (checkReseller) {// if reseller exist for claim
          emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: `${checkReseller.name}`,
            content: `We are pleased to inform you that your claim Claim ID: - ${checkClaim.unique_key} has been successfully completed. All necessary repairs or services associated with your claim have been finalized`,
            content1: `If you have any further questions or require additional support, please feel free to contact us at support@getcover.com.`,
            content2: '',
            subject: `Claim Completion Notification – Claim ID:  ${checkClaim.unique_key}`
          }
          mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendCompletionResellerNotification, ["noreply@getcover.com"], emailData))
        }

        emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: `${checkCustomer.username}`,
          content: `We are pleased to inform you that your claim Claim ID: - ${checkClaim.unique_key} has been successfully completed. All necessary repairs or services associated with your claim have been finalized`,
          content1: `If you have any further questions or require additional support, please feel free to contact us at support@getcover.com.`,
          content2: '',
          subject: `Claim Completion Notification – Claim ID:  ${checkClaim.unique_key}`
        }
        mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendCompletionCustomerNotification, ["noreply@getcover.com"], emailData))
        //Email to Servicer
        if (servicerPrimary) {

          const sendServicerCompletionNotification = servicerUsers.map(user => user.email);
          emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: `${checkServicer.name}`,
            content: `We are pleased to inform you that Claim ID ${checkClaim.unique_key} has been successfully completed. Thank you for your prompt and professional service in handling this claim. Your efforts have been invaluable in ensuring a smooth process for our customer.`,
            content1: `Should you have any questions or require additional information, please do not hesitate to reach out.`,
            content2: '',
            subject: "Claim Update – Service Completion Confirmed"
          }
          mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendServicerCompletionNotification, ["noreply@getcover.com"], emailData))

        }
        //Email to admin       
        const sendAdminNotification = adminUsers.map(user => user.email);
        emailData = {
          darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
          lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
          address: settingData[0]?.address,
          websiteSetting: settingData[0],
          senderName: "Admin",
          content: `This is to inform you that the completion process for Claim ID: ${checkClaim.unique_key} has been successfully carried out. All steps have been finalized, and the customer has been notified of the claim completion`,
          content2: '',
          content1: '',
          subject: "Action Notification – Claim Completion Processed"
        }
        mailing = sgMail.send(emailConstant.sendClaimStatusNotification(sendAdminNotification, ['noreply@getcover.com'], emailData))
      }
    }

    if (data.hasOwnProperty("claimType")) {
      let claimType = await claimService.updateClaim(criteria, { claimType: data.claimType }, { new: true })
    }
    // Keep history of status in mongodb 
    let updateStatus = await claimService.updateClaim(criteria, { $push: status }, { new: true })

    // Update every status 
    let updateBodyStatus = await claimService.updateClaim(criteria, updateData, { new: true })
    if (!updateStatus) {
      //Save logs
      let logData = {
        userId: req.userId,
        endpoint: "claim/editClaimStatus",
        body: data,
        response: {
          code: constant.errorCode,
          message: 'Unable to update status!',
          result: updateBodyStatus
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to update status!'
      })
      return;
    }


    let baseDate = new Date(checkContract.coverageStartDate);
    let newDateToCheck = new Date()
    const newDayOfMonth = newDateToCheck.getDate();
    const dayOfMonth = baseDate.getDate();

    // Get the current year and month
    const currentYear1 = new Date().getFullYear();
    const currentMonth1 = new Date().getMonth(); // Note: 0 = January, so this is the current month index

    // Create a new date with the current year, current month, and the day from baseDate
    let newDateWithSameDay = new Date(currentYear1, currentMonth1, dayOfMonth);
    if (Number(newDayOfMonth) > Number(dayOfMonth)) {
      newDateWithSameDay = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() - 1));
    }

    const monthlyEndDate = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() + 1)); // Ends on August 11, 2024
    const yearlyEndDate = new Date(new Date(newDateWithSameDay).setFullYear(newDateWithSameDay.getFullYear() + 1)); // Ends on July 11, 2025

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Start of today (00:00)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today (23:59)

    let getNoOfClaimQuery = [
      {
        $match: {
          contractId: new mongoose.Types.ObjectId(checkClaim.contractId),
          claimFile: "completed"
        }
      },
      {
        $group: {
          _id: null,
          monthlyCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', newDateWithSameDay] },
                    { $lt: ['$createdAt', monthlyEndDate] }
                  ]
                },
                1,
                0
              ]
            }
          },
          yearlyCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', newDateWithSameDay] },
                    { $lt: ['$createdAt', yearlyEndDate] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    let forCheckOnly;

    //Eligibility true when claim is completed and rejected
    if (updateBodyStatus.claimFile == 'completed') {
      if (checkContract.isMaxClaimAmount) {
        if (checkContract.productValue > claimTotal[0]?.amount) {
          const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
          forCheckOnly = true
        }
        else if (checkContract.productValue < claimTotal[0]?.amount) {
          const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: false }, { new: true })
          forCheckOnly = false
        }
      } else {
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
        forCheckOnly = true

      }

      //Amount reset of the claim in rejected claim
      if (updateBodyStatus.claimFile == 'rejected') {
        let updatePrice = await claimService.updateClaim(criteria, { totalAmount: 0, customerClaimAmount: 0, getCoverClaimAmount: 0, customerOverAmount: 0, getcoverOverAmount: 0 }, { new: true })
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
        forCheckOnly = true
      }

      if (forCheckOnly) {
        let checkNoOfClaims = await claimService.getClaimWithAggregate(getNoOfClaimQuery)
        console.log(checkNoOfClaims, "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        if (checkNoOfClaims.length == 0) {
          checkNoOfClaims = [{
            "monthlyCount": 0,
            "yearlyCount": 0
          }]
        }
        let checkThePeriod = checkContract.noOfClaim
        let getTotalClaim = await claimService.getClaims({ contractId: checkClaim.contractId, claimFile: "completed" })
        let noOfTotalClaims = getTotalClaim.length
        if (checkThePeriod.value != -1) {
          if (checkThePeriod.period == "Monthly") {
            let eligibility = checkNoOfClaims[0].monthlyCount >= checkThePeriod.value ? false : true
            if (eligibility) {
              if (checkContract.noOfClaimPerPeriod != -1) {
                eligibility = noOfTotalClaims >= checkContract.noOfClaimPerPeriod ? false : true

              }
            }
            const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: eligibility }, { new: true })
          } else {
            let eligibility = checkNoOfClaims[0].yearlyCount >= checkThePeriod.value ? false : true

            if (eligibility) {
              if (checkContract.noOfClaimPerPeriod != -1) {

                eligibility = noOfTotalClaims >= checkContract.noOfClaimPerPeriod ? false : true
              }
            }
            const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: eligibility }, { new: true })
          }
        }
      }
    }


    if (updateBodyStatus.claimFile == 'rejected') {
      let updatePrice = await claimService.updateClaim(criteria, { totalAmount: 0, customerClaimAmount: 0, getCoverClaimAmount: 0, customerOverAmount: 0, getcoverOverAmount: 0 }, { new: true })
      const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
      forCheckOnly = true
    }

    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimStatus",
      body: data,
      response: {
        code: constant.successCode,
        result: updateBodyStatus
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateBodyStatus
    })

  } catch (err) {
    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimStatus catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message,
        stack: err.stack
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message,
      stack: err.stack
    })
  }
}

//Edit servicer in claim Done
exports.editServicer = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.claimId }
    let settingData = await userService.getSetting({});
    let checkClaim = await claimService.getClaimById(criteria)
    let checkContract = await contractService.getContractById({ _id: checkClaim.contractId })
    const checkOrder = await orderService.getOrder({ _id: checkContract.orderId }, { isDeleted: false })
    const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId })
    const base_url = `${process.env.SITE_URL}claim-listing/${checkClaim.unique_key}`
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    if (req.body.servicerId == "") {
      req.body.servicerId = null
    }
    let isPureServicer = ''
    if (req.body.servicerId != "") {
      criteria = { _id: req.body.servicerId }
      let checkServicer = await servicerService.getServiceProviderById({
        $or: [
          { _id: req.body.servicerId },
          { dealerId: req.body.servicerId },
          { resellerId: req.body.servicerId },
        ]
      })
      isPureServicer = checkServicer.dealerId != null ? false : checkServicer.resellerId == null ? true : false

      if (!checkServicer) {
        res.send({
          code: constant.errorCode,
          message: "Servicer not found!"
        })
        return
      }

    }


    let updateServicer = await claimService.updateClaim({ _id: req.params.claimId }, data, { new: true })
    if (!updateServicer) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "editServicer/:claimId",
        body: data,
        response: {
          code: constant.errorCode,
          message: 'Unable to update servicer!'
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to update servicer!'
      })
      return;
    }


    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "editServicer/:claimId",
      body: data,
      response: {
        code: constant.successCode,
        message: updateServicer,
      }
    }

    await LOG(logData).save()

    //send notification to admin and dealer 
    let notificationArray = []
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const site_url = `${process.env.SITE_URL}`
    const adminServicerUpdateQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
              ]
            },

          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminServicerUpdateQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    if (adminUsers.length > 0) {
      let notificationAdmin = {
        title: "Servicer updated Successfully",
        description: `Servicer for Claim # ${checkClaim.unique_key} has been updated in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        notificationFor: IDs,
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
      };
      notificationArray.push(notificationAdmin)
    }

    //Dealer Notification
    const dealerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.dealerId },
              ]
            },
          ]
        }
      },
    }

    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerAddClaimQuery, { email: 1 })
    const dealerIds = dealerUsers.map(user => user._id)
    if (dealerUsers.length > 0) {
      let notificationDealer = {
        title: "Servicer updated Successfully",
        description: `Servicer for Claim # ${checkClaim.unique_key} has been updated in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        notificationFor: dealerIds,
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
      };
      notificationArray.push(notificationDealer)
    }

    //Reseller Notification
    const resellerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.resellerId },
              ]
            },
          ]
        }
      },
    }
    let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerAddClaimQuery, { email: 1 })
    const resellerIds = resellerUsers.map(user => user._id)

    if (resellerUsers.length > 0) {
      let notificationReseller = {
        title: "Servicer updated Successfully",
        description: `Servicer for Claim # ${checkClaim.unique_key} has been updated in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        notificationFor: resellerIds,
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
      };
      notificationArray.push(notificationReseller)
    }

    //Customer Notification
    const customerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { metaId: checkOrder.customerId },

              ]
            },
          ]
        }
      },
    }
    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerAddClaimQuery, { email: 1 })
    const customerIds = customerUsers.map(user => user._id)
    if (customerUsers.length > 0) {
      let notificationCustomer = {
        title: "Servicer updated Successfully",
        description: `Servicer for Claim # ${checkClaim.unique_key} has been updated in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        notificationFor: customerIds,
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
      };
      notificationArray.push(notificationCustomer)
    }

    //Servicer Notification
    const servicerAddClaimQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { metaId: checkClaim?.servicerId },
              ]
            },
          ]
        }
      },
    }
    let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerAddClaimQuery, { email: 1 })
    const servicerIds = servicerUsers.map(user => user._id)
    if (servicerUsers.length > 0) {
      let notificationServicer = {
        title: "Servicer updated Successfully",
        description: `You have been assigned a new Claim # ${checkClaim.unique_key} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        notificationFor: servicerIds,
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
      };
      notificationArray.push(notificationServicer)
    }
    let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.body.servicerId, isPrimary: true } } })


    let createNotification = await userService.saveNotificationBulk(notificationArray);

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    // notificationEmails.push(getPrimary.email);
    const servicerCaseNotification = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.servicerUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                { metaId: checkClaim?.servicerId },
              ]
            },

          ]
        }
      },
    }
    let servicerCaseUser = await supportingFunction.getNotificationEligibleUser(servicerCaseNotification, { email: 1 })
    let adminUser = servicerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.super_admin.toString());
    let servicerUser = servicerCaseUser.filter(user => user.metaData[0]?.roleId.toString() === process.env.servicer.toString());
    const adminEmail = adminUser.map(user => user.email)
    const servicerEmail = servicerUser.map(user => user.email)

    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: getPrimary ? getPrimary.metaData[0].firstName : "",
      model: checkContract.model,
      serial: checkContract.serial,
      manufacturer: checkContract.manufacture,
      subject: `New Device Received for Repair - ID: ${checkClaim.unique_key}`,
      redirectId: base_url,
      content: `We want to inform you that ${checkCustomer.username} has requested for the repair of a device detailed below:`

    }
    emailData.senderName = "Admin"
    let mailing = sgMail.send(emailConstant.sendServicerClaimNotification(adminEmail, ["noreply@getcover.com"], emailData))
    emailData.senderName = getPrimary ? getPrimary.metaData[0].firstName : ""
    mailing = sgMail.send(emailConstant.sendServicerClaimNotification(servicerEmail, ["noreply@getcover.com"], emailData))
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateServicer,
      isPureServicer: isPureServicer
    })

  }
  catch (err) {
    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "editServicer catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }

}

// Save bulk claim(21 oct 24)

//Save bulk claim


exports.saveBulkClaim = async (req, res) => {
  uploadP(req, res, async (err) => {
    try {
      let data = req.body
      let headerLength;
      const bucketReadUrl = { Bucket: process.env.bucket_name, Key: req.file.key };
      // Await the getObjectFromS3 function to complete
      const result = await getObjectFromS3(bucketReadUrl);

      const emailField = req.body.email;

      // // Parse the email field
      const emailArray = JSON.parse(emailField);

      //Get all emails of the login user
      let length = [8, 5];
      let match = {}
      if (req.role == 'Dealer') {
        length = [4, 7];
        match = { "order.dealer._id": new mongoose.Types.ObjectId(req.userId) }
      }

      if (req.role == 'Reseller') {
        length = [4, 7];
        match = { "order.reseller._id": new mongoose.Types.ObjectId(req.userId) }
      }

      if (req.role == 'Customer') {
        length = [4, 7];
        match = { "order.customers._id": new mongoose.Types.ObjectId(req.userId) }
      }

      headerLength = result.headers

      // if (!length.includes(headerLength.length)) {
      //   res.send({
      //     code: constant.errorCode,
      //     message: "Invalid file format detected. Please check file format!"
      //   })
      //   return
      // }

      const totalDataComing1 = result.data;

      let totalDataComing = totalDataComing1.map((item, i) => {
        const keys = Object.keys(item);
        // Check if the "servicerName" header exists    
        if (req.role == "Super Admin") {
          if (keys.length >= 8) {
            let coverageType = item[keys[4]]
            let dateLoss1 = item[keys[2]]
            return {
              contractId: item[keys[0]],
              servicerName: item[keys[1]],
              lossDate: dateLoss1.toString(),
              diagnosis: item[keys[3]],
              coverageType: coverageType,
              issue: item[keys[5]],
              userEmail: item[keys[6]],
              shippingTo: item[keys[7]],
              duplicate: false,
              exit: false
            };
          }
          if (keys.length >= 5) {

            let coverageType = item[keys[4]]
            let dateLoss1 = item[keys[2]]
            return {
              contractId: item[keys[0]],
              servicerName: item[keys[1]],
              lossDate: dateLoss1.toString(),
              diagnosis: item[keys[3]],
              coverageType: coverageType,
              issue: '',
              userEmail: '',
              shippingTo: '',
              duplicate: false,
              exit: false
            };
          }
          else {
            res.send({
              code: constant.errorCode,
              message: "Invalid File format!"
            })
            return
          }
        }
        else {
          if (keys.length >= 7) {

            let coverageType = item[keys[3]]
            let dateLoss2 = item[keys[1]]
            // If "servicerName" does not exist, shift the second item to "lossDate"
            return {
              contractId: item[keys[0]],
              servicerName: '',
              lossDate: dateLoss2.toString(),
              diagnosis: item[keys[2]],  // Assuming diagnosis is now at index 2
              coverageType: coverageType,
              issue: item[keys[4]],
              userEmail: item[keys[5]],
              shippingTo: item[keys[6]],
              duplicate: false,
              exit: false
            };
          }
          if (keys.length >= 4) {

            let coverageType = item[keys[3]]
            let dateLoss2 = item[keys[1]]
            // If "servicerName" does not exist, shift the second item to "lossDate"
            return {
              contractId: item[keys[0]],
              servicerName: '',
              lossDate: dateLoss2.toString(),
              diagnosis: item[keys[2]],  // Assuming diagnosis is now at index 2
              coverageType: coverageType,
              issue: '',
              userEmail: '',
              shippingTo: '',
              duplicate: false,
              exit: false
            };
          }
          else {
            res.send({
              code: constant.errorCode,
              message: "Invalid File format!"
            })
            return
          }

        }
      });

      if (totalDataComing.length === 0) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file!"
        });
        return;
      }

      // Assign servicer when servicer is empty in the list
      for (let u = 0; u < totalDataComing.length; u++) {
        let objectToCheck = totalDataComing[u]
        if (objectToCheck) {
          if (objectToCheck.servicerName == '' || objectToCheck.servicerName == null) {
            let getContractDetail = await contractService.getContractById({
              $and: [
                {
                  $or: [
                    { unique_key: objectToCheck.contractId },
                    { serial: objectToCheck.contractId },
                  ],

                },
                { eligibilty: true }
              ],

            });
            let getOrderDetail = await orderService.getOrder({ _id: getContractDetail?.orderId })
            if (getOrderDetail?.servicerId != null) {
              let getServiceData = await servicerService.getServicerByName({
                $or: [
                  { _id: getOrderDetail.servicerId },
                  { dealerId: getOrderDetail.servicerId },
                  { resellerId: getOrderDetail.servicerId },
                ]
              })
              totalDataComing[u].servicerName = getServiceData.name
            }
          }
        }


      }
      //Trim the space from the sheet data
      totalDataComing = totalDataComing.map((item, i) => {
        if (item.hasOwnProperty("servicerName")) {
          return {
            contractId: item.contractId?.toString().replace(/\s+/g, ' ').trim(),
            servicerName: item.servicerName?.toString().replace(/\s+/g, ' ').trim(),
            coverageType: item.coverageType?.toString().replace(/\s+/g, ' ').trim(),
            lossDate: item.lossDate?.toString().replace(/\s+/g, ' ').trim(),
            diagnosis: item.diagnosis?.toString().replace(/\s+/g, ' ').trim(),
            issue: item.issue?.toString().replace(/\s+/g, ' ').trim(),
            userEmail: item.userEmail?.toString().replace(/\s+/g, ' ').trim(),
            shippingTo: item.shippingTo?.toString().replace(/\s+/g, ' ').trim(),
            duplicate: false,
            exit: false
          };
        }
        else {
          return {
            contractId: item.contractId?.toString().replace(/\s+/g, ' ').trim(),
            lossDate: item.lossDate?.toString().replace(/\s+/g, ' ').trim(),
            servicerName: item.servicerName?.toString().replace(/\s+/g, ' ').trim(),
            coverageType: item.coverageType?.toString().replace(/\s+/g, ' ').trim(),
            diagnosis: item.diagnosis?.toString().replace(/\s+/g, ' ').trim(),
            issue: item.issue?.toString().replace(/\s+/g, ' ').trim(),
            userEmail: item.userEmail?.toString().replace(/\s+/g, ' ').trim(),
            shippingTo: item.shippingTo?.toString().replace(/\s+/g, ' ').trim(),
            duplicate: false,
            exit: false
          };
        }

      });

      //check sheet data is not empty for specific field
      let cache = {};
      totalDataComing.forEach(data => {
        if (!data.contractId || data.contractId == "") {
          data.status = "Serial number/Asset ID/Contract number cannot be empty"
          data.exit = true
        }
        if (!data.lossDate || data.lossDate == "") {
          data.status = "Loss date cannot be empty"
          data.exit = true
        }

        if (!moment(data.lossDate).isValid()) {
          data.status = "Date is not valid format"
          data.exit = true
        }

        if (new Date(data.lossDate) > new Date()) {
          data.status = "Date can not greater than today"
          data.exit = true
        }
        data.lossDate = data.lossDate
        if (!data.diagnosis || data.diagnosis == "") {
          data.status = "Diagnosis can not be empty"
          data.exit = true
        }

      })

      //check duplicasy of the contract id
      totalDataComing.forEach((data, i) => {
        if (!data.exit) {
          if (cache[data.contractId?.toLowerCase()]) {
            data.status = "Duplicate contract id/serial number"
            data.exit = true;
          } else {
            cache[data.contractId?.toLowerCase()] = true;
          }
        }
      })

      //Check contract is exist or not using contract id
      const contractArrayPromise = totalDataComing.map(item => {
        if (!item.exit) return contractService.getContractById({
          $and: [
            {
              $or: [
                { unique_key: item.contractId },
                { serial: item.contractId },
              ],
            },
            { eligibilty: true }
          ],

        });
        else {
          return null;
        }
      })

      // get contract with dealer,reseller, servicer
      const contractArray = await Promise.all(contractArrayPromise);


      let servicerArray;
      //Check servicer is exist or not using contract id
      if (req.role == "Super Admin") {
        const servicerArrayPromise = totalDataComing.map(item => {
          if (!item.exit && item.servicerName != '') {
            const thename = item.servicerName;
            return servicerService.getServiceProviderById({
              "name":
                { $regex: new RegExp("^" + thename.toLowerCase(), "i") }
            });
          }
          else {
            return null;
          }
        })
        servicerArray = await Promise.all(servicerArrayPromise);
      }

      const claimArray = await claimService.getClaims({
        claimFile: 'open'
      });

      // Get Contract with dealer, customer, reseller
      const contractAllDataPromise = totalDataComing.map(item => {
        if (!item.exit) {
          let query = [
            {
              $match: {
                $and: [
                  {
                    $or: [
                      { unique_key: item.contractId },
                      { serial: item.contractId },
                    ],
                  },
                  { eligibilty: true }
                ]
              },
            },
            {
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
                pipeline: [
                  {
                    $lookup: {
                      from: "dealers",
                      localField: "dealerId",
                      foreignField: "_id",
                      as: "dealer",
                      pipeline: [
                        {
                          $lookup: {
                            from: "servicer_dealer_relations",
                            localField: "_id",
                            foreignField: "dealerId",
                            as: "dealerServicer",
                          }
                        },
                      ]
                    }
                  },
                  {
                    $lookup: {
                      from: "resellers",
                      localField: "resellerId",
                      foreignField: "_id",
                      as: "reseller",
                    }
                  },
                  {
                    $lookup: {
                      from: "customers",
                      localField: "customerId",
                      foreignField: "_id",
                      as: "customers"
                    }
                  },
                  {
                    $lookup: {
                      from: "serviceproviders",
                      localField: "servicerId",
                      foreignField: "_id",
                      as: "servicer",
                    }
                  },
                ],
              },
            },
            {
              $match: match
            },
            {
              $project: {
                orderId: 1,
                _id: 1,
                "order.dealerId": 1,
                "order.customerId": 1,
                "order._id": 1,
                "order.unique_key": 1,
                "order.servicerId": 1,
                "order.resellerId": 1,
                "order.customers": 1,
                "order.dealer": 1,
                "order.reseller": 1,
                "order.servicer": 1
              }
            },
            { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.dealer", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.reseller", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.customers", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.servicer", preserveNullAndEmptyArrays: true } },
            { $limit: 1 }
          ]
          return contractService.getAllContracts2(query)
        }
        else {
          return null;
        }
      })

      const contractAllDataArray = await Promise.all(contractAllDataPromise)

      let getCoverageTypeFromOption = await optionService.getOption({ name: "coverage_type" })
      let checkSerialCache = {};
      //Filter data which is contract , servicer and not active
      for (let k = 0; k < totalDataComing.length; k++) {
        let item = totalDataComing[k]
        let i = k
        if (!item.exit) {
          const contractData = contractArray[i];
          const allDataArray = contractAllDataArray[i];
          const claimData = claimArray;
          const servicerData = servicerArray == undefined || servicerArray == null ? allDataArray[0]?.order?.servicer : servicerArray[i]
          let flag;

          item.contractData = contractData;
          item.claimType = ''
          item.servicerData = servicerData;
          item.orderData = allDataArray[0]

          if (!contractData || allDataArray.length == 0) {
            item.status = "Contract not found"
            item.exit = true;

            //check contract eligibility reason
            let checkContractData = await contractService.getContractById({
              $and: [
                {
                  $or: [
                    { unique_key: item.contractId },
                    { serial: item.contractId },
                  ],
                },
              ],
            })
            if (checkContractData && checkContractData != null) {
              item.status = " "
              if (checkContractData.status != "Active") {
                item.status = "Contract is not active"
                item.exit = true;
              }

              if (new Date(checkContractData.minDate) > new Date()) {
                const options = {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                };
                const formattedDate = new Date(checkContractData.minDate).toLocaleDateString('en-US', options)
                item.status = "Contract will be eligible on " + " " + formattedDate
                item.exit = true;
              }

              let claimQuery = [
                {
                  $match: { contractId: new mongoose.Types.ObjectId(checkContractData._id) }
                },
                {
                  $group: {
                    _id: null,
                    totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
                    openFileClaimsCount: { // Count of claims where claimfile is "Open"
                      $sum: {
                        $cond: {
                          if: { $eq: ["$claimFile", "open"] }, // Assuming "claimFile" field is correct
                          then: 1,
                          else: 0
                        }
                      }
                    }
                  }
                }
              ]

              let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
              if (checkClaims[0]) {
                if (checkClaims[0].openFileClaimsCount > 0) {
                  item.status = "Contract has open claim"
                  item.exit = true;

                }
                if (checkClaims[0].totalAmount >= checkContractData.productValue) {
                  item.status = "Claim value exceed the product value limit"
                  item.exit = true;
                }
              }
            }
          }
          if (contractData) {
            if (checkSerialCache[contractData?.unique_key?.toLowerCase()]) {
              item.status = "Duplicate contract id/serial number"
              item.exit = true;
            } else {
              checkSerialCache[contractData.unique_key?.toLowerCase()] = true;
            }
          }

          if (item.coverageType) {
            if (item.coverageType != null || item.coverageType != "") {
              if (contractData) {
                let checkCoverageTypeForContract = contractData?.coverageType.find(item1 => item1.label == item?.coverageType)
                if (!checkCoverageTypeForContract) {
                  item.status = "Coverage type is not available for this contract!";
                  item.exit = true;
                }
                const checkCoverageValue = getCoverageTypeFromOption.value.filter(option => option.label === item?.coverageType).map(item1 => item1.value);
                let startDateToCheck = new Date(contractData.coverageStartDate)
                let coverageTypeDays = contractData?.adhDays
                let getDeductible = coverageTypeDays?.filter(coverageType => coverageType.value == checkCoverageValue[0])

                let checkCoverageTypeDate = startDateToCheck.setDate(startDateToCheck.getDate() + Number(getDeductible[0]?.waitingDays))
                checkCoverageTypeDate = new Date(checkCoverageTypeDate).setHours(0, 0, 0, 0)
                let checkLossDate = new Date(item.lossDate).setHours(0, 0, 0, 0)
                const result = getCoverageTypeFromOption?.value.filter(option => option.label === item?.coverageType).map(item1 => item1.label);

                if (new Date(checkCoverageTypeDate) > new Date(checkLossDate)) {
                  item.status = `Claim not eligible for ${result[0]}.`
                  item.exit = true;
                }
                item.claimType = checkCoverageValue[0]
              }


            }
          }
          // check login email
          if (item.userEmail != '') {
            item.submittedBy = item.userEmail
            if (item.orderData?.order?.customers) {
              let memberEmail = await userService.getMembers({
                metaData: { $elemMatch: { metaId: item.orderData?.order?.customers._id } }
              }, {})

              if (memberEmail.length > 0) {
                const validEmail = memberEmail?.find(member => member.email === item.userEmail);

                if (!validEmail || validEmail == undefined) {
                  item.status = "Invalid Email"
                  item.exit = true;
                }
              }
            }


          }
          // check Shipping address
          if (item.shippingTo != '') {
            if (allDataArray[0]?.order.customers) {
              let shipingAddress = item.shippingTo.split(',');   // Split the string by commas
              let userZip = shipingAddress[shipingAddress.length - 1];
              let addresses = allDataArray[0]?.order.customers.addresses
              addresses.push(
                {
                  zip: allDataArray[0]?.order.customers.zip,
                  state: allDataArray[0]?.order.customers.zip,
                  city: allDataArray[0]?.order.customers.city,
                  street: allDataArray[0]?.order.customers.street,
                  country: allDataArray[0]?.order.customers.country,
                })

              const validAddress = addresses?.find(address => Number(address.zip) === Number(userZip));
              if (!validAddress) {
                item.status = "Invalid user address!"
                item.exit = true;
              }
            }
            item.shippingTo = item.shippingTo
          }

          let checkCoverageStartDate = new Date(contractData?.coverageStartDate).setHours(0, 0, 0, 0)
          if (contractData && new Date(checkCoverageStartDate) > new Date(item.lossDate)) {
            item.status = "Loss date should be in between coverage start date and present date!"
            item.exit = true;
          }

          if (allDataArray.length > 0 && servicerData) {

            flag = false;
            if (allDataArray[0]?.order.dealer.dealerServicer.length > 0) {
              //Find Servicer with dealer Servicer
              const servicerCheck = allDataArray[0]?.order.dealer.dealerServicer.find(item => item.servicerId?.toString() === servicerData._id?.toString())
              if (servicerCheck) {

                flag = true
              }
            }
            //Check dealer itself servicer
            if (allDataArray[0]?.order.dealer?.isServicer && allDataArray[0]?.order.dealer?.accountStatus && allDataArray[0]?.order.dealer._id?.toString() === servicerData.dealerId?.toString()) {

              flag = true
            }

            if (allDataArray[0]?.order.reseller?.isServicer && allDataArray[0]?.order.reseller?.status && allDataArray[0]?.order.reseller?._id?.toString() === servicerData.resellerId?.toString()) {

              flag = true
            }
          }
          if ((item?.servicerName != '' && !servicerData)) {
            flag = false
          }
          if ((!flag && flag != undefined && item.hasOwnProperty("servicerName") && req.role == "Admin")) {
            item.status = "Servicer not found"
          }
          if (contractData && contractData.status != "Active") {
            item.status = "Contract is not active";
            item.exit = true;
          }

        } else {
          item.contractData = null
          item.servicerData = null
        }
      }
      let finalArray = []
      //Save bulk claim

      let currentYear = new Date().getFullYear();
      currentYear = "-" + currentYear + "-"

      let count = await claimService.getClaimCount({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });
      let unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000

      //Update eligibility when contract is open
      const updateArrayPromise = totalDataComing.map(item => {
        if (!item.exit && item.contractData) return contractService.updateContract({ _id: item.contractData._id }, { eligibilty: false }, { new: true });
        else {
          return null;
        }
      })
      const updateArray = await Promise.all(updateArrayPromise);
      let existArray = {
        data: {}
      };
      let emailServicerId = [];


      totalDataComing.map((data, index) => {
        let servicerId = data.servicerData?._id
        if (data.servicerData?.dealerId) {
          servicerId = data.servicerData?.dealerId
        }
        if (data.servicerData?.resellerId) {
          servicerId = data.servicerData?.resellerId
        }
        const issue = data.issue != "" ? data.issue + "-" + data.diagnosis : data.diagnosis
        // emailDealerId.push(data.orderData?.order?.dealerId);
        if (!data.exit) {
          let obj = {
            contractId: data.contractData._id,
            orderId: data.orderData?.order?.unique_key,
            servicerId: data?.claimType == "theft_and_lost" ? null : servicerId,
            dealerId: data.orderData?.order?.dealerId,
            claimType: data?.claimType,
            resellerId: data.orderData?.order?.resellerId,
            dealerSku: data.contractData?.dealerSku,
            submittedBy: data?.submittedBy,
            shippingTo: data?.shippingTo,
            customerId: data.orderData?.order?.customerId,
            venderOrder: data.contractData.venderOrder,
            serial: data.contractData.serial,
            productName: data.contractData.productName,
            pName: data.contractData.pName,
            model: data.contractData.model,
            manufacture: data.contractData.manufacture,
            unique_key_number: unique_key_number,
            unique_key_search: "CC" + currentYear + unique_key_number,
            unique_key: "CC" + currentYear + unique_key_number,
            diagnosis: issue,
            lossDate: data.lossDate,
            claimFile: 'open',
          }
          unique_key_number++
          finalArray.push(obj)
          data.status = 'Add claim successfully!'
        }

      })
      //save bulk claim
      const saveBulkClaim = await claimService.saveBulkClaim(finalArray)

      //Assign Claim id to the particular contract
      // Add `claimId` based on the matching serials
      totalDataComing.forEach(item => {
        if (!item.exit) {
          const matchingData = saveBulkClaim.find(data => data.serial === item.contractData.serial || item.contractData._id.toString() == data.contractId.toString());
          if (matchingData) {
            item.claimId = matchingData.unique_key;
          }
        }
      });


      let IDs = await supportingFunction.getUserIds()
      let adminEmail = await supportingFunction.getUserEmails();
      let new_admin_array = adminEmail.concat(emailArray)
      //  let new_admin_array = adminEmail
      let toMail = [];
      let ccMail;
      const userId = req.userId;
      let resellerData 

      //Get Fail and Passes Entries
      const counts = totalDataComing.reduce((acc, obj) => {
        // Increment the count of true or false based on the value of exit
        if (obj.exit) {
          acc.trueCount += 1;
        } else {
          acc.falseCount += 1;
        }
        return acc;
      }, { trueCount: 0, falseCount: 0 });

      let getDealerIds = []
      let getResellerIds = []
      let getCustomerIds = []
      let getServicerIds = []
      const csvArray = await Promise.all(totalDataComing.map(async (item, i) => {
        // Build bulk csv for dealer only
        let localDateString = new Date(item.lossDate)
        let formattedDate = localDateString.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric"
        })
        getDealerIds.push(item.orderData?.order?.dealerId)
        getResellerIds.push(item.orderData?.order?.resellerId)
        getCustomerIds.push(item.orderData?.order?.customerId)
        let servicerId = item.servicerData?._id
        if (item.servicerData?.dealerId) {
          servicerId = item.servicerData?.dealerId
        }
        if (item.servicerData?.resellerId) {
          servicerId = item.servicerData?.resellerId
        }
        getServicerIds.push(servicerId)

        if (req.role === 'Dealer') {
          const userId = req.userId;
          ccMail = new_admin_array;
          let userData = await userService.getUserById1({ metaData: { $elemMatch: { metaId: userId, isPrimary: true } } }, {});
          if (req.userId.toString() === item.orderData?.order?.dealerId?.toString()) {
            // For servicer
            if (!existArray.data[servicerId] && servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              emailServicerId.push(servicerId);
              existArray.data[servicerId] = [];
            }

            if (servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              existArray.data[servicerId].push({
                "Contract# / Serial#": item.contractId ? item.contractId : "",
                "Claim#": item.claimId ? item.claimId : "",
                "Loss Date": item.lossDate ? formattedDate : '',
                Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
                "Coverage Type": item.coverageType ? item.coverageType : '',
                "Submitted By": item.userEmail ? item.userEmail : '',
                "Ship To": item.shippingTo ? item.shippingTo : ''
              });
            }

          }
          return {
            "Contract#/Serial#": item.contractId ? item.contractId : "",

            "Loss Date": item.lossDate ? formattedDate : '',
            Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
            "Coverage Type": item.coverageType ? item.coverageType : '',
            "Submitted By": item.userEmail ? item.userEmail : '',
            "Ship To": item.shippingTo ? item.shippingTo : '',
            Status: item.status ? item.status : '',
            exit: item.exit
          };
        }
        // Build bulk csv for Reseller only
        else if (req.role === 'Reseller') {
          ccMail = new_admin_array;
          if (req.userId.toString() === item.orderData?.order?.resellerId?.toString()) {
            // For servicer
            if (!existArray.data[servicerId] && servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              emailServicerId.push(servicerId);
              existArray.data[servicerId] = [];
            }

            if (servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              existArray.data[servicerId].push({
                "Contract# / Serial#": item.contractId ? item.contractId : "",
                "Claim#": item.claimId ? item.claimId : "",
                "Loss Date": item.lossDate ? formattedDate : '',
                Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
                "Coverage Type": item.coverageType ? item.coverageType : '',
                "Submitted By": item.userEmail ? item.userEmail : '',
                "Ship To": item.shippingTo ? item.shippingTo : '',

              });
            }

          }
          return {
            "Contract# / Serial#": item.contractId ? item.contractId : "",
            "Loss Date": item.lossDate ? formattedDate : '',
            Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
            "Coverage Type": item.coverageType ? item.coverageType : '',
            "Submitted By": item.userEmail ? item.userEmail : '',
            "Ship To": item.shippingTo ? item.shippingTo : '',
            Status: item.status ? item.status : '',
            exit: item.exit
          };
        }
        // Build bulk csv for Customer only
        else if (req.role === 'Customer') {
          ccMail = new_admin_array;

          if (req.userId.toString() === item.orderData?.order?.customerId?.toString()) {
            // For servicer
            if (!existArray.data[servicerId] && servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              emailServicerId.push(servicerId);
              existArray.data[servicerId] = [];
            }

            if (servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
              existArray.data[servicerId].push({
                "Contract# / Serial#": item.contractId ? item.contractId : "",
                "Claim#": item.claimId ? item.claimId : "",
                "Loss Date": item.lossDate ? formattedDate : '',
                Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
                "Coverage Type": item.coverageType ? item.coverageType : '',
                "Submitted By": item.userEmail ? item.userEmail : '',
                "Ship To": item.shippingTo ? item.shippingTo : '',

              });
            }

          }
          return {
            "Contract# / Serial#": item.contractId ? item.contractId : "",
            "Loss Date": item.lossDate ? formattedDate : '',
            Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
            "Coverage Type": item.coverageType ? item.coverageType : '',
            "Submitted By": item.userEmail ? item.userEmail : '',
            "Ship To": item.shippingTo ? item.shippingTo : '',
            Status: item.status ? item.status : '',
            exit: item.exit
          };
        } else {
          toMail = new_admin_array;
          ccMail = ["noreply@getcover.com"];
          // For servicer
          if (!existArray.data[servicerId] && servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
            emailServicerId.push(servicerId);
            existArray.data[servicerId] = [];
          }

          if (servicerId != undefined && !item.exit && item?.claimType != "theft_and_lost") {
            existArray.data[servicerId].push({
              "Contract# / Serial#": item.contractId ? item.contractId : "",
              "Claim#": item.claimId ? item.claimId : "",
              "Loss Date": item.lossDate ? formattedDate : '',
              Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
              "Coverage Type": item.coverageType ? item.coverageType : '',
              "Submitted By": item.userEmail ? item.userEmail : '',
              "Ship To": item.shippingTo ? item.shippingTo : '',

            });
          }

          return {
            "Contract# / Serial#": item.contractId ? item.contractId : "",
            Servicer: item.servicerName || "",
            "Loss Date": item.lossDate ? formattedDate : '',
            Diagnosis: item.issue ? item.issue + "-" + item.diagnosis : item.diagnosis,
            "Coverage Type": item.coverageType ? item.coverageType : '',
            "Submitted By": item.userEmail ? item.userEmail : '',
            "Ship To": item.shippingTo ? item.shippingTo : '',
            Status: item.status ? item.status : '',
            exit: item.exit
          };
        }
      }));

      //get email of all servicer
      let emailServicer = await userService.getMembers({ metaData: { $elemMatch: { metaId: { $in: emailServicerId }, isPrimary: true } } }, {});
      // If you need to convert existArray.data to a flat array format
      if (emailServicer.length > 0) {
        let flatArray = [];
        for (let servicerId in existArray.data) {
          let matchData = emailServicer.find(matchServicer => matchServicer.metaData[0].metaId?.toString() === servicerId.toString());
          let email = matchData ? matchData.email : ''; // Replace servicerId with email if matchData is found
          flatArray.push({
            email: email,
            response: existArray.data[servicerId]
          });
        }
        //send email to servicer      
        for (const item of flatArray) {
          if (item.email != '') {
            const htmlTableString = convertArrayToHTMLTable(item.response, []);
            let mailing_servicer = await sgMail.send(emailConstant.sendCsvFile(item.email, adminEmail, htmlTableString));
          }

        }
      }

      //Convert Array to HTML table
      function convertArrayToHTMLTable(array, array1) {
        var htmlContent = '';
        if (array.length > 0) {
          const header = Object.keys(array[0]).filter(key => key !== 'exit').map(key => `<th>${key}</th>`).join('');
          const rows = array.map(obj => {
            const values = Object.entries(obj)
              .filter(([key]) => key !== 'exit')  // Exclude 'exit' key
              .map(([, value]) => `<td>${value}</td>`);

            values[2] = `${values[2]}`; // Keep this line if you have specific logic for this index
            return values.join('');
          });

          htmlContent += `
          <html>
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
        }

        if (array1.length > 0) {
          const header = Object.keys(array1[0]).filter(key => key !== 'exit').map(key => `<th>${key}</th>`).join('');

          const rows = array1.map(obj => {
            const values = Object.entries(obj)
              .filter(([key]) => key !== 'exit')  // Exclude 'exit' key
              .map(([, value]) => `<td>${value}</td>`);

            values[2] = `${values[2]}`; // Keep this line if you have specific logic for this index
            return values.join('');
          });

          htmlContent += `
          <html>
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
                <tr>
                <td colspan="2" style="text-align:center">Total claims: ${parseInt(counts.trueCount) + parseInt(counts.falseCount)}</td>
                </tr>
                <tr>
                    <td span="1" style="text-align:center">Failure claims: ${counts.trueCount}</td>
                    <td span="1" style="text-align:center">Successful added claims: ${counts.falseCount}</td>
                </tr>
                </table>
                <table>
                    <thead><tr>${header}</tr></thead>
                    <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                </table>
            </body>
          </html>`;
        }

        return htmlContent;

      }
      let adminBulkQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.fileBulkClaim": true },
              { status: true },
              { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
            ]
          }
        },
      }
      let dealerBulkQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.fileBulkClaim": true },
              { status: true },
              { metaId: { $in: getDealerIds } },
            ]
          }
        },
      }
      let resellerBulkQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.fileBulkClaim": true },
              { status: true },
              { metaId: { $in: getResellerIds } },
            ]
          }
        },
      }
      let customerBulkQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.fileBulkClaim": true },
              { metaId: { $in: getCustomerIds } },
              { status: true },
            ]
          }
        },
      }
      let servicerrBulkQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "claimNotification.fileBulkClaim": true },
              { status: true },
              { metaId: { $in: getServicerIds } },

            ]
          }
        },
      }

      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminBulkQuery, { email: 1 })
      let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerBulkQuery, { email: 1 })
      let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerBulkQuery, { email: 1 })
      let customerUsers = await supportingFunction.getNotificationEligibleUser(customerBulkQuery, { email: 1 })
      let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerrBulkQuery, { email: 1 })
      if (saveBulkClaim.length > 0) {

        let notificationArray = []
        let adminId = adminUsers.map(user => user._id);
        let dealerId = dealerUsers.map(user => user._id);
        let resellerId = resellerUsers.map(user => user._id);
        let customerId = customerUsers.map(user => user._id);
        let servicerId = servicerUsers.map(user => user._id);
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        let notificationData1;
        if (adminUsers.length > 0) {
          notificationData1 = {
            title: "Bulk Claim added successfully",
            description: `Bulk claim file ${req.file.originalname} has been uploaded and successfully processed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
            userId: req.teammateId,
            flag: 'Bulk Claim',
            notificationFor: adminId,
            redirectionId: "/claimList",
            endPoint: base_url + "claimList"
          };
          notificationArray.push(notificationData1)
        }
        if (dealerUsers.length > 0) {
          notificationData1 = {
            title: "Bulk Claim added successfully",
            description: `Bulk claim file ${req.file.originalname} has been uploaded and successfully processed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
            userId: req.teammateId,
            flag: 'Bulk Claim',
            notificationFor: dealerId,
            redirectionId: "/claimList",
            endPoint: base_url + "claimList"
          };
          notificationArray.push(notificationData1)
        }
        if (resellerUsers.length > 0) {
          notificationData1 = {
            title: "Bulk Claim added successfully",
            description: `Bulk claim file ${req.file.originalname} has been uploaded and successfully processed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
            userId: req.teammateId,
            flag: 'Bulk Claim',
            notificationFor: resellerId,
            redirectionId: "/claimList",
            endPoint: base_url + "claimList"
          };
          notificationArray.push(notificationData1)
        }
        if (customerUsers.length > 0) {
          notificationData1 = {
            title: "Bulk Claim added successfully",
            description: `Bulk claim file ${req.file.originalname} has been uploaded and successfully processed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
            userId: req.teammateId,
            flag: 'Bulk Claim',
            notificationFor: customerId,
            redirectionId: "/claimList",
            endPoint: base_url + "claimList"
          };
          notificationArray.push(notificationData1)
        }
        if (servicerUsers.length > 0) {
          notificationData1 = {
            title: "Bulk Claim added successfully",
            description: `Bulk claim file ${req.file.originalname} has been uploaded and successfully processed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
            userId: req.teammateId,
            flag: 'Bulk Claim',
            notificationFor: servicerId,
            redirectionId: "/claimList",
            endPoint: base_url + "claimList"
          };
          notificationArray.push(notificationData1)
        }
        let createNotification = await userService.saveNotificationBulk(notificationArray);
      }
      //Get Failure Claims 
      const successEntries = csvArray.filter(entry => entry.exit === false);
      const failureEntries = csvArray.filter(entry => entry.exit === true);

      let mailing;
      let htmlTableString;
      // Send Email notification for all roles user
      if (req.role == "Dealer") {
        let dealerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: req.userId },
                { status: true },
              ]
            }
          },
        }
        let allDealer = await supportingFunction.getNotificationEligibleUser(dealerEmailBulkQuery, { email: 1 })

        let adminEmail = adminUsers.map(user => user.email);
        let dealerEmail= allDealer.map(user => user.email);

        if (failureEntries.length > 0) {
          htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmail, ["noreply@getcover.com"], htmlTableString));
          mailing = sgMail.send(emailConstant.sendCsvFile(adminEmail, ["noreply@getcover.com"], htmlTableString));
        }

        else {
          let htmlContent = `
          <html>
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
                <tr>
                <td colspan="2" style="text-align:center">Total filed claims: ${parseInt(counts.trueCount) + parseInt(counts.falseCount)}</td>
                </tr>
                <tr>
                    <td span="1" style="text-align:center">Failure claims: ${counts.trueCount}</td>
                    <td span="1" style="text-align:center">Successful added claims: ${counts.falseCount}</td>
                </tr>
                </table>
            </body>
          </html>`;

          //htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmail, ["noreply@getcover.com"], htmlContent));
          mailing = sgMail.send(emailConstant.sendCsvFile(adminEmail, ["noreply@getcover.com"], htmlContent));
        }
        // mailing = sgMail.send(emailConstant.sendCsvFile(toMail, ccMail, htmlTableString));
      }
      if (req.role == "Reseller") {
        const loginReseller = await resellerService.getReseller({ _id: req.userId }, {});

        let resellerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: req.userId },
                { status: true },
              ]
            }
          },
        }
        let resellerDealerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: loginReseller?.dealerId },
                { status: true },
              ]
            }
          },
        }

        let allReseller = await supportingFunction.getNotificationEligibleUser(resellerEmailBulkQuery, { email: 1 })
        let allResellersDealer = await supportingFunction.getNotificationEligibleUser(resellerDealerEmailBulkQuery, { email: 1 })
        let resellerEmails = allReseller.map(customer => customer.email);
        let dealerEmails = allResellersDealer.map(customer => customer.email);
        if (failureEntries.length > 0) {
          htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(resellerEmails, ["noreply@getcover.com"], htmlTableString));
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmails, ["noreply@getcover.com"], htmlTableString));
        }

        else {
          let htmlContent = `
          <html>
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
                <tr>
                <td colspan="2" style="text-align:center">Total filed claims: ${parseInt(counts.trueCount) + parseInt(counts.falseCount)}</td>
                </tr>
                <tr>
                    <td span="1" style="text-align:center">Failure claims: ${counts.trueCount}</td>
                    <td span="1" style="text-align:center">Successful added claims: ${counts.falseCount}</td>
                </tr>
                </table>
            </body>
          </html>`;

          //htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(resellerEmails, ["noreply@getcover.com"], htmlContent));
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmails, ["noreply@getcover.com"], htmlContent));
        }
      }
      if (req.role == "Customer") {
        let loginCustomer = await customerService.getCustomerById({ _id: req.userId });

        let customerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: req.userId },
                { status: true },
              ]
            }
          },
        }
        let customerDealerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: loginCustomer?.dealerId },
                { status: true },
              ]
            }
          },
        }
        let customerResellerEmailBulkQuery = {
          metaData: {
            $elemMatch: {
              $and: [
                { "claimNotification.fileBulkClaim": true },
                { metaId: loginCustomer?.resellerId1 },
                { status: true },
              ]
            }
          },
        }
        let allCustomers = await supportingFunction.getNotificationEligibleUser(customerEmailBulkQuery, { email: 1 })
        let allCustomersDealer = await supportingFunction.getNotificationEligibleUser(customerDealerEmailBulkQuery, { email: 1 })
        let allCustomersReseller = await supportingFunction.getNotificationEligibleUser(customerResellerEmailBulkQuery, { email: 1 })
        let customerEmails = allCustomers.map(customer => customer.email);
        let dealerEmails = allCustomersDealer.map(customer => customer.email);
        let resellerEmails = allCustomersReseller.map(customer => customer.email);
        if (failureEntries.length > 0) {
          htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(customerEmails, ["noreply@getcover.com"], htmlTableString));
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmails, ["noreply@getcover.com"], htmlTableString));
          mailing = sgMail.send(emailConstant.sendCsvFile(resellerEmails, ["noreply@getcover.com"], htmlTableString));
        }

        else {
          let htmlContent = `
          <html>
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
                <tr>
                <td colspan="2" style="text-align:center">Total filed claims: ${parseInt(counts.trueCount) + parseInt(counts.falseCount)}</td>
                </tr>
                <tr>
                    <td span="1" style="text-align:center">Failure claims: ${counts.trueCount}</td>
                    <td span="1" style="text-align:center">Successful added claims: ${counts.falseCount}</td>
                </tr>
                </table>
            </body>
          </html>`;

          //htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(customerEmails, ["noreply@getcover.com"], htmlContent));
          mailing = sgMail.send(emailConstant.sendCsvFile(dealerEmails, ["noreply@getcover.com"], htmlContent));
          mailing = sgMail.send(emailConstant.sendCsvFile(resellerEmails, ["noreply@getcover.com"], htmlContent));
        }
      }
      //send Email to admin
      if (req.role == "Super Admin") {
        let adminEmail = adminUsers.map(user => user.email);
        if (failureEntries.length > 0) {
          htmlTableString = convertArrayToHTMLTable([], failureEntries);
          // let adminEmail = adminUsers.map
          mailing = sgMail.send(emailConstant.sendCsvFile(adminEmail, ["noreply@getcover.com"], htmlTableString));
        }

        else {
          let htmlContent = `
          <html>
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
                <tr>
                <td colspan="2" style="text-align:center">Total filed claims: ${parseInt(counts.trueCount) + parseInt(counts.falseCount)}</td>
                </tr>
                <tr>
                    <td span="1" style="text-align:center">Failure claims: ${counts.trueCount}</td>
                    <td span="1" style="text-align:center">Successful added claims: ${counts.falseCount}</td>
                </tr>
                </table>
            </body>
          </html>`;

          //htmlTableString = convertArrayToHTMLTable([], failureEntries);
          mailing = sgMail.send(emailConstant.sendCsvFile(adminEmail, ccMail, htmlContent));
        }


      }


      res.send({
        code: constant.successCode,
        message: 'Success!',
        result: saveBulkClaim
      })

    }
    catch (err) {
      res.send({
        code: constant.errorCode,
        message: err.message,
        message_line: err.stack
      })
    }
  })

}
//Send message Done
exports.sendMessages = async (req, res) => {
  try {
    let data = req.body
    let emailTo;
    let criteria = { _id: req.params.claimId }

    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    let settingData = await userService.getSetting({});

    data.claimId = req.params.claimId
    let orderData = await orderService.getOrder({ _id: data.orderId }, { isDeleted: false })
    if (!orderData) {
      res.send({
        code: constant.errorCode,
        message: 'Order is not found for this claim!'
      })
      return
    }

    data.commentedBy = req.userId
    data.commentedTo = req.userId;
    data.commentedByUser = req.teammateId
    const commentByUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })

    emailTo = await supportingFunction.getPrimaryUser({ _id: req.teammateId, metaData: { $elemMatch: { isPrimary: true } } })
    if (data.type == 'Reseller') {
      data.commentedTo = orderData.resellerId
      emailTo = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.resellerId, isPrimary: true } } })
    }
    else if (data.type == 'Dealer') {
      data.commentedTo = orderData.dealerId
      emailTo = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.dealerId, isPrimary: true } } })
    }
    else if (data.type == 'Customer') {
      data.commentedTo = orderData.customerId
      emailTo = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.customerId, isPrimary: true } } })
    }
    else if (data.type == 'Servicer') {
      data.commentedTo = orderData.servicerId
      emailTo = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkClaim.servicerId, isPrimary: true } } })
    }

    let sendMessage = await claimService.addMessage(data)

    if (!sendMessage) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "sendMessages",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to send message",
          result: sendMessage
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: 'Unable to send message!'
      });
      return;
    }
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "sendMessages",
      body: data,
      response: {
        code: constant.successCode,
        messages: 'Message Sent!',
        result: sendMessage
      }
    }
    await LOG(logData).save()

    //Send notification to all
    //Get submitted user
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const site_url = `${process.env.SITE_URL}`
    const adminCommentQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
              ]
            },

          ]
        }
      },
    }
    const dealerCommentQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { metaId: new mongoose.Types.ObjectId(orderData.dealerId) },
              ]
            },

          ]
        }
      },
    }
    const resellerCommentQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { metaId: new mongoose.Types.ObjectId(orderData?.resellerId) },
              ]
            },

          ]
        }
      },
    }
    const customerCommentQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { metaId: new mongoose.Types.ObjectId(orderData.customerId) },
              ]
            },

          ]
        }
      },
    }
    const servicerCommentQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { metaId: new mongoose.Types.ObjectId(checkClaim?.servicerId ? checkClaim?.servicerId : orderData?.servicerId) },
              ]
            },

          ]
        }
      },
    }

    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminCommentQuery, { email: 1 })
    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerCommentQuery, { email: 1 })
    let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerCommentQuery, { email: 1 })
    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerCommentQuery, { email: 1 })
    let servicerUsers = await supportingFunction.getNotificationEligibleUser(servicerCommentQuery, { email: 1 })
    let notificationArray = []

    let IDs = adminUsers.map(user => user._id)
    let adminEmail = adminUsers.map(user => user.email)
    let dealerId = dealerUsers.map(user => user._id)
    let resellerId = resellerUsers.map(user => user._id)
    let customerId = customerUsers.map(user => user._id)
    let servicerId = servicerUsers.map(user => user._id)

    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.dealerId, isPrimary: true } } })
    let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.customerId, isPrimary: true } } })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.resellerId, isPrimary: true } } })
    let servicerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: orderData.servicerId, isPrimary: true } } })
    if (adminUsers.length > 0) {
      let notificationData1 = {
        title: "New Claim Comment added",
        description: `Claim # ${checkClaim.unique_key} A new comment has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
        notificationFor: IDs
      };
      notificationArray.push(notificationData1)
    }
    if (dealerUsers.length > 0) {
      let notificationData1 = {
        title: "New Claim Comment added",
        description: `Claim # ${checkClaim.unique_key} A new comment has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
        notificationFor: dealerId
      };
      notificationArray.push(notificationData1)
    }
    if (resellerUsers.length > 0) {
      let notificationData1 = {
        title: "New Claim Comment added",
        description: `Claim # ${checkClaim.unique_key} A new comment has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
        notificationFor: resellerId
      };
      notificationArray.push(notificationData1)
    }
    if (customerUsers.length > 0) {
      let notificationData1 = {
        title: "New Claim Comment added",
        description: `Claim # ${checkClaim.unique_key} A new comment has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
        notificationFor: customerId
      };
      notificationArray.push(notificationData1)
    }
    if (servicerUsers.length > 0) {
      let notificationData1 = {
        title: "New Claim Comment added",
        description: `Claim # ${checkClaim.unique_key} A new comment has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}`,
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        endPoint: site_url + "claim-listing/" + checkClaim.unique_key,
        redirectionId: "claim-listing/" + checkClaim.unique_key,
        notificationFor: servicerId
      };
      notificationArray.push(notificationData1)
    }

    let createNotification = await userService.saveNotificationBulk(notificationArray);

    // Send Email code here
    const commentCaseQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "claimNotification.claimComment": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                { metaId: new mongoose.Types.ObjectId(checkClaim?.servicerId) },
              ]
            },

          ]
        }
      },
    }
    let commentNotification = await supportingFunction.getNotificationEligibleUser(commentCaseQuery, { email: 1 })
    let notificationEmails = commentNotification.map(user => user.email);
    const base_url = `${process.env.SITE_URL}claim-listing/${checkClaim.unique_key}`
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      commentBy: commentByUser.metaData[0].firstName + " " + commentByUser.metaData[0].lastName + "-" + req.role,
      date: new Date().toLocaleDateString("en-US"),
      senderName: emailTo?.metaData[0].firstName + " " + emailTo?.metaData[0].lastName,
      comment: data.content,
      content: `A new comment has been added to Claim #${checkClaim.unique_key}. Here are the details:`,
      subject: `New Comment on Claim #${checkClaim.unique_key}`,
      redirectId: base_url
    }

    let mailing = sgMail.send(emailConstant.sendCommentNotification(emailTo?.email, ["noreply@getcover.com"], emailData))
    mailing = sgMail.send(emailConstant.sendCommentNotification(adminEmail, ["noreply@getcover.com"], emailData))
    res.send({
      code: constant.successCode,
      messages: 'Message Sent!',
      result: sendMessage
    })

  }
  catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "sendMessages catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.successCode,
        result: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      messages: err.message
    })
  };
}

//Automatic completed when servicer shipped after 7 days cron job
exports.statusClaim = async (req, res) => {
  try {
    const result = await claimService.getClaims({
      'repairStatus.status': 'servicer_shipped',
      claimFile: "open"
    });

    let updateStatus

    for (let i = 0; i < result.length; i++) {
      let messageData = {};
      const repairStatus = result[i].repairStatus;
      let contractId = result[i].contractId;
      const claimId = result[i]._id;
      const customerStatus = result[i].customerStatus;
      //Get latest Servicer Shipped Status
      const latestServicerShipped = repairStatus[0]?.date
      //Get Customer last response
      const customerLastResponseDate = customerStatus[0]?.date
      const latestServicerShippedDate = new Date(latestServicerShipped);
      const sevenDaysAfterShippedDate = new Date(latestServicerShippedDate);
      sevenDaysAfterShippedDate.setDate(sevenDaysAfterShippedDate.getDate() + 14);

      if (new Date() === sevenDaysAfterShippedDate || new Date() > sevenDaysAfterShippedDate) {
        // Update status for track status
        messageData.trackStatus = [
          {
            status: 'completed',
            date: new Date()
          }
        ]

        updateStatus = await claimService.updateClaim({ _id: claimId }, {
          $push: messageData,
          $set: { claimFile: 'completed', claimDate: new Date(), claimStatus: [{ status: 'completed', date: new Date() }] }
        }, { new: true })

        const query = { contractId: new mongoose.Types.ObjectId(contractId) }

        let checkContract = await contractService.getContractById({ _id: contractId })

        let claimTotalQuery = [
          { $match: query },
          { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

        ]

        let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);

        // Update Eligibilty true and false
        if (checkContract.isMaxClaimAmount) {
          if (checkContract.productValue > claimTotal[0]?.amount) {
            const updateContract = await contractService.updateContract({ _id: contractId }, { eligibilty: true }, { new: true })
          }
          else if (checkContract.productValue < claimTotal[0]?.amount) {
            const updateContract = await contractService.updateContract({ _id: contractId }, { eligibilty: false }, { new: true })
          }
        } else {
          const updateContract = await contractService.updateContract({ _id: contractId }, { eligibilty: true }, { new: true })
        }

      }
    }

    res.send({
      code: constant.successCode,
      //updateStatus
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//------------------- testing --------------------//
// s3 bucket 
const StorageP1 = multerS3({
  s3: s3,
  bucket: process.env.bucket_name,
  metadata: (req, files, cb) => {
    cb(null, { fieldName: files.fieldname });
  },
  key: (req, files, cb) => {
    const fileName = files.fieldname + '-' + Date.now() + path.extname(files.originalname);
    const fullPath = `${folderName}/${fileName}`;
    cb(null, fullPath);
  }
});
var imageUploadS3 = multer({
  storage: StorageP1,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).any([
  { name: "file" },
  { name: "termCondition" },
])
exports.s3Bucket = async (req, res) => {
  try {
    imageUploadS3(req, res, (err) => {
      if (err) {
        return res.send(err.message);
      }
      res.send({ ddd: 'File uploaded successfully', ttt: req.files });
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get all claims api
exports.getAllClaims = async (req, res, next) => {
  try {
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    let servicerMatch = {}
    // checking the user type from token
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      servicerMatch = { servicerId: new mongoose.Types.ObjectId(req.userId) }
    }
    // building the query for claims
    let newQuery = [];
    newQuery.push({
      $facet: {
        totalRecords: [
          {
            $count: "total"
          }
        ],
        data: [
          {
            $skip: skipLimit
          },
          {
            $limit: pageLimit
          },
          {
            $lookup: {
              from: "servicer_dealer_relations",
              localField: "contracts.orders.dealers._id",
              foreignField: "dealerId",
              as: "contracts.orders.dealers.dealerServicer",
            }
          },
          {
            $lookup: {
              from: "resellers",
              localField: "contracts.orders.resellerId",
              foreignField: "_id",
              as: "contracts.orders.resellers",
            }
          },
          {
            $project: {
              "contractId": 1,
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              trackingNumber: 1,
              trackingType: 1,
              dealerSku: 1,
              claimType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.pName": 1,
              "contracts.manufacture": 1,
              "contracts.serial": 1,
              "contracts.orders.dealerId": 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.serviceCoverageType": 1,
              "contracts.orders.coverageType": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.dealers.isShippingAllowed": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers.accountStatus": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              "contracts.orders.dealers.dealerServicer": {
                $map: {
                  input: "$contracts.orders.dealers.dealerServicer",
                  as: "dealerServicer",
                  in: {
                    "_id": "$$dealerServicer._id",
                    "servicerId": "$$dealerServicer.servicerId",
                  }
                }
              },
              "contracts.orders.servicers": {
                $map: {
                  input: "$contracts.orders.servicers",
                  as: "servicer",
                  in: {
                    "_id": "$$servicer._id",
                    "name": "$$servicer.name",
                  }
                }
              },
              "contracts.orders.resellers": {
                $map: {
                  input: "$contracts.orders.resellers",
                  as: "reseller",
                  in: {
                    "_id": "$$reseller._id",
                    "name": "$$reseller.name",
                    "isServicer": "$$reseller.isServicer",
                    "status": "$$reseller.status"
                  }
                }
              }
            }
          },
        ]
      }
    })

    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer.length > 0) {
        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
        servicerMatch = {
          $or: [
            { "servicerId": { $in: servicerIds } },
            { "servicerId": { $in: dealerIds } },
            { "servicerId": { $in: resellerIds } }
          ]
        };
      }
      else {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
      }
    }

    if (data.dealerName != "") {
      let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
      let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
      dealerMatch = { dealerId: { $in: dealerIds } }
      console.log(dealerMatch)

    }

    if (data.resellerName != "") {
      let getReseller = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName : '', '$options': 'i' } }, { _id: 1 })
      let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
      resellerMatch = { resellerId: { $in: resellerIds } }

    }
    let claimPaidStatus = {}
    if (data.claimPaidStatus != '' && data.claimPaidStatus != undefined) {
      claimPaidStatus = { "claimPaymentStatus": data.claimPaidStatus }
    }
    else {
      claimPaidStatus = {
        $or: [
          { "claimPaymentStatus": "Paid" },
          { "claimPaymentStatus": "Unpaid" },
        ]
      }
    }
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            claimPaidStatus,
            { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'dealerSku': { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            servicerMatch
          ]
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $match:
        {
          $and: [
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },
      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.isDeleted": false },
            match
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $match:
        {
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
        }
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "contracts.orders.servicerId",
          foreignField: "_id",
          as: "contracts.orders.servicers",
        }
      },
      {
        $lookup: {
          from: "customers",
          localField: "contracts.orders.customerId",
          foreignField: "_id",
          as: "contracts.orders.customer",
        }
      },
      {
        $unwind: "$contracts.orders.customer"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
    ]

    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getClaimWithAggregate(lookupQuery);
    let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

    let allServicerIds = [];

    // Iterate over the data array
    resultFiter.forEach(item => {
      // Iterate over the dealerServicer array in each item
      item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
        // Push the servicerId to the allServicerIds array
        allServicerIds.push(dealer.servicerId);
      });
    });

    //Get Dealer and Reseller Servicers
    let servicer;
    let servicerName = '';
    //service call from claim services
    let allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let selfResellerServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
        if (dealerOfServicer) {
          servicer.push(dealerOfServicer)
        }
      });

      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }

      if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
        servicer.unshift(item1.contracts.orders.resellers[0])
      }

      if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
        servicer.unshift(item1.contracts.orders.dealers)
      }

      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer?._id?.toString() === item1.servicerId?.toString());
        selfServicer = req.role == "Customer" ? false : item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
        selfResellerServicer = item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString()
      }

      return {
        ...item1,
        servicerData: servicerName,
        selfResellerServicer: selfResellerServicer,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0 // getting the total count 

    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get claims api admin
exports.getClaims = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 0
    let contractIds = []
    let contractCheck = 0
    let orderIds = []
    let mainQuery = []

    if (data.customerName != "") {
      userSearchCheck = 1
      let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        customerIds = await getData.map(customer => customer._id)
      } else {
        customerIds.push("1111121ccf9d400000000000")
      }
    };
    if (data.servicerName != "") {
      userSearchCheck = 1
      let getData = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })

      if (getData.length > 0) {
        servicerIds = await getData.map(servicer => servicer._id)
      } else {
        servicerIds.push("1111121ccf9d400000000000")
      }
    };

    let orderAndCondition = []


    //making the query on the bases of search query payload
    if (dealerIds.length > 0) {
      orderAndCondition.push({ dealerId: { $in: dealerIds } })
    }
    if (customerIds.length > 0) {
      orderAndCondition.push({ customerId: { $in: customerIds } })
    }
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })
    }
    if (resellerIds.length > 0) {
      orderAndCondition.push({ resellerId: { $in: resellerIds } })
    }
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order.unique_key)
      }
    }

    let claimFilter = [
      { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { serial: { '$regex': data.serial ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
      { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
      { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
      { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
    ]

    if (data.contractId != "") {
      let getContractId = await contractService.findContracts({ unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      contractCheck = 1
      if (getContractId.length > 0) {
        contractIds = getContractId.map(ID => ID._id)
      } else {
        contractIds.push("1111121ccf9d400000000000")
      }
    }
    if (userSearchCheck == 1) {
      claimFilter.push({ orderId: { $in: orderIds } })
    }
    if (contractCheck == 1) {
      claimFilter.push({ contractId: { $in: contractIds } })
    }

    // checking if the user is searching or just getting the data
    if (data.contractId === "" && data.productName === "" && data.pName === "" && data.serial === "" && data.customerStatusValue && data.repairStatus === "" && data.claimStatus === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0 && contractCheck == 0) {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $facet: {
            totalRecords: [
              {
                $count: "total"
              }
            ],
            data: [
              {
                $skip: skipLimit
              },
              {
                $limit: pageLimit
              }
            ],
          },

        },
      ]
    } else {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $match:
          {
            $and: claimFilter
          },
        },
      ]
      mainQuery.push({
        $facet: {
          totalRecords: [
            {
              $count: "total"
            }
          ],
          data: [
            {
              $skip: skipLimit
            },
            {
              $limit: pageLimit
            },

          ],
        },

      })
    }

    let getClaims = await claimService.getClaimWithAggregate(mainQuery)

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaims,
      query: mainQuery
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message, err: err.stack
    })
  }
}

//Get Unpaid claim value -- not using
exports.getUnpaidAmount = async (req, res, next) => {
  try {
    const ids = req.body.claimIds;
    const claimId = ids.map(id => new mongoose.Types.ObjectId(id))
    let claimTotalQuery = [
      { $match: { _id: { $in: claimId } } },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    const response = await claimService.getClaimWithAggregate(claimTotalQuery);
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: {
        totalClaims: ids.length,
        unpaidValue: response[0]?.amount
      }
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get contract by id
exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: totalCreteria },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]

    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    let query = [
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.contractId) },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
          pipeline: [
            {
              $lookup: {
                from: "dealers",
                localField: "dealerId",
                foreignField: "_id",
                as: "dealer",
              }
            },
            {
              $lookup: {
                from: "resellers",
                localField: "resellerId",
                foreignField: "_id",
                as: "reseller",
              }
            },
            {
              $lookup: {
                from: "customers",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
              }
            },
            {
              $lookup: {
                from: "serviceproviders",
                localField: "servicerId",
                foreignField: "_id",
                as: "servicer",
              }
            },

          ],

        }
      },
    ]
    let getData = await contractService.getContracts(query, skipLimit, pageLimit)
    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }

    let orderId = getData[0].orderProductId
    let order = getData[0].order

    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderId.toString())
      productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
      getData[0].order[i].productsArray = productsArray
    }
    getData.map((data, index) => {
      if (data.order[0]?.servicerId != null) {
        if (data.order[0]?.dealer[0]?.isServicer && data.order[0]?.dealerId.toString() === data.order[0]?.servicerId.toString()) {
          data.order[0]?.servicer.push(data.order[0]?.dealer[0])
          getData[index] = data
        }
        if (data.order[0]?.reseller.length > 0) {
          if (data.order[0]?.reseller[0]?.isServicer && data.order[0]?.resellerId.toString() === data.order[0]?.servicerId.toString()) {
            data.order[0]?.servicer.push(data.order[0]?.reseller[0])
            getData[index] = data
          }

        }
      }

    })

    if (!getData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get contract"
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getData[0]
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get messages
exports.getMessages = async (req, res) => {

  const checkClaim = await claimService.getClaimById({ _id: req.params.claimId }, { isDeleted: false })
  if (!checkClaim) {
    res.send({
      code: constant.errorCode,
      message: 'Invalid Claim id!'
    })
    return;
  }

  let lookupQuery = [
    {
      $match:
      {
        $and: [
          { claimId: new mongoose.Types.ObjectId(req.params.claimId) }
        ]
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "commentedTo",
        foreignField: "metaId",
        as: "commentTo",
        pipeline: [
          {
            $match:
            {
              $and: [
                { isPrimary: true },
                { metaId: { $ne: null } }
              ]
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
            }
          }
        ]

      }
    },
    { $unwind: { path: "$commentTo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "commentedByUser",
        foreignField: "_id",
        as: "commentBy",
        pipeline: [
          {
            $lookup: {
              from: 'roles',
              localField: 'roleId',
              foreignField: '_id',
              as: 'roles'
            }
          },
          {
            $unwind: "$roles"
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              "roles.role": 1,
            }
          }
        ]
      }
    },
    { $unwind: { path: "$commentBy", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        date: 1,
        type: 1,
        messageFile: 1,
        content: 1,
        "commentBy": 1,
        "commentTo": 1,
      }
    }
  ]

  let allMessages = await claimService.getAllMessages(lookupQuery);
  res.send({
    code: constant.successCode,
    messages: 'Success!',
    result: allMessages
  })
}

//get max claim amout to claimed
exports.getMaxClaimAmount = async (req, res) => {
  try {
    const query = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    const contract = await contractService.getContractById({ _id: req.params.contractId }, { productValue: 1 })
    const claimAmount = claimTotal[0]?.amount ? claimTotal[0]?.amount : 0
    const product = contract ? contract.productValue : 0
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: product - claimAmount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get coverage type in claim
exports.getCoverageType = async (req, res) => {
  try {
    const checkContract = await contractService.getContractById({ _id: req.params.contractId });
    if (!checkContract) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find Contract!"
      });
      return
    }
    const query = { _id: new mongoose.Types.ObjectId(checkContract.orderId) }

    const orderData = await orderService.getOrder(query, { isDeleted: false })

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: checkOrder
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.checkNumberOfCertainPeriod = async (req, res) => {
  try {
    const query = { eligibilty: true };
    const limit = 10000; // Adjust the limit based on your needs
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await contractService.findContracts2(query, limit, page);
      if (result.length === 0) {
        hasMore = false;
        break;
      }

      for (let i = 0; i < result.length; i++) {
        let checkContract = result[i]
        let baseDate = new Date(checkContract.coverageStartDate);
        let newDateToCheck = new Date()
        const newDayOfMonth = newDateToCheck.getDate();
        const dayOfMonth = baseDate.getDate();

        // Get the current year and month
        const currentYear1 = new Date().getFullYear();
        const currentMonth1 = new Date().getMonth(); // Note: 0 = January, so this is the current month index

        // Create a new date with the current year, current month, and the day from baseDate
        let newDateWithSameDay = new Date(currentYear1, currentMonth1, dayOfMonth);
        if (Number(newDayOfMonth) > Number(dayOfMonth)) {
          newDateWithSameDay = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() - 1));
        }

        const monthlyEndDate = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() + 1)); // Ends on August 11, 2024
        const yearlyEndDate = new Date(new Date(newDateWithSameDay).setFullYear(newDateWithSameDay.getFullYear() + 1)); // Ends on July 11, 2025

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        let getNoOfClaimQuery = [
          {
            $match: {
              contractId: new mongoose.Types.ObjectId(checkContract._id),
              claimFile: "completed"
            }
          },
          {
            $group: {
              _id: null,
              monthlyCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$createdAt', newDateWithSameDay] },
                        { $lt: ['$createdAt', monthlyEndDate] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              yearlyCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$createdAt', newDateWithSameDay] },
                        { $lt: ['$createdAt', yearlyEndDate] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ];

        let checkNoOfClaims = await claimService.getClaimWithAggregate(getNoOfClaimQuery)
        if (checkNoOfClaims.length == 0) {
          checkNoOfClaims = [{
            "monthlyCount": 0,
            "yearlyCount": 0
          }]
        }
        let checkThePeriod = checkContract.noOfClaim
        let getTotalClaim = await claimService.getClaims({ contractId: checkContract._id, claimFile: "completed" })
        let noOfTotalClaims = getTotalClaim.length
        if (checkThePeriod.value != -1) {
          if (checkThePeriod.period == "Monthly") {
            let eligibility = checkNoOfClaims[0].monthlyCount >= checkThePeriod.value ? false : true
            if (eligibility) {
              if (checkContract.noOfClaimPerPeriod != -1) {
                eligibility = noOfTotalClaims >= checkContract.noOfClaimPerPeriod ? false : true

              }
            }
            const updateContract = await contractService.updateContract({ _id: checkContract._id }, { eligibilty: eligibility }, { new: true })
          } else {
            let eligibility = checkNoOfClaims[0].yearlyCount >= checkThePeriod.value ? false : true

            if (eligibility) {
              if (checkContract.noOfClaimPerPeriod != -1) {

                eligibility = noOfTotalClaims >= checkContract.noOfClaimPerPeriod ? false : true
              }
            }
            const updateContract = await contractService.updateContract({ _id: checkContract._id }, { eligibilty: eligibility }, { new: true })
          }
        }

      }
      page++;
    }

    res.send({
      code: constant.successCode,
    });


  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateClaimDate = async (req, res) => {
  try {

    let baseDate = new Date('2024-07-03');
    let newDateToCheck = new Date()
    const newDayOfMonth = newDateToCheck.getDate();
    const dayOfMonth = baseDate.getDate();

    // Get the current year and month
    const currentYear1 = new Date().getFullYear();
    const currentMonth1 = new Date().getMonth(); // Note: 0 = January, so this is the current month index

    // Create a new date with the current year, current month, and the day from baseDate
    let newDateWithSameDay = new Date(currentYear1, currentMonth1, dayOfMonth);
    if (Number(newDayOfMonth) > Number(dayOfMonth)) {
      newDateWithSameDay = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() - 1));
    }

    const monthlyEndDate = new Date(new Date(newDateWithSameDay).setMonth(newDateWithSameDay.getMonth() + 1)); // Ends on August 11, 2024
    const yearlyEndDate = new Date(new Date(newDateWithSameDay).setFullYear(newDateWithSameDay.getFullYear() + 1)); // Ends on July 11, 2025
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Start of today (00:00)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today (23:59)

    let getNoOfClaimQuery = [
      {
        $match: {
          contractId: new mongoose.Types.ObjectId("6712381331a2529f6e009d85"),
          claimFile: "completed"
        }
      },
      {
        $group: {
          _id: null,
          monthlyCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', newDateWithSameDay] },
                    { $lt: ['$createdAt', monthlyEndDate] }
                  ]
                },
                1,
                0
              ]
            }
          },
          yearlyCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', newDateWithSameDay] },
                    { $lt: ['$createdAt', yearlyEndDate] }
                  ]
                },
                1,
                0
              ]
            }
          },
          todayCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gte: ['$createdAt', startOfToday
                      ]
                    },
                    {
                      $lt: ['$createdAt', endOfToday
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];


    let checkNoOfClaims = await claimService.getClaimWithAggregate(getNoOfClaimQuery)

    res.send({
      checkNoOfClaims, getNoOfClaimQuery
    })





    // let emailData = {
    //   // darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + "settingData[0]?.logoDark.fileName",
    //   // lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
    //   address: "settingData[0]?.address",
    //   websiteSetting: "settingData[0]",
    //   senderName: "emailTo?.firstName",
    //   content: "The new message for " + "checkClaim.unique_key" + " claim",
    //   subject: "New Message"
    // }
    // let mailing = sgMail.send(emailConstant.sendEmailTemplate("anil@codenomad.net", ["amit@codenomad.net"], "emailData"))
    // res.send({
    //   mailing
    // })











    // let updateObject = {
    //   $set: {
    //     customerStatus: [
    //       {
    //         status: "request_submitted",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       }
    //     ],
    //     trackStatus: [
    //       {
    //         status: "open",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       },
    //       {
    //         status: "request_submitted",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       },
    //       {
    //         status: "request_sent",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       }
    //     ],
    //     claimStatus: [
    //       {
    //         status: "open",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       },
    //     ],
    //     repairStatus: [
    //       {
    //         status: "request_sent",
    //         date: "2024-10-22T17:31:03.140+00:00"
    //       }
    //     ]
    //   }
    // }
    // let updateClaim = await claimService.markAsPaid({ orderId: "GC-2024-100003" }, updateObject, { new: true })

  } catch (err) {
    res.send({
      code: err.stack
    })
  }
}

