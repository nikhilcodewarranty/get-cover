require("dotenv").config();
const path = require("path");
const { comments } = require("../../models/Claim/comment");
const LOG = require('../../models/User/logs')
const claimService = require("../../services/Claim/claimService");
const claimReportingService = require("../../services/Claim/claimReportingService");
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
const constant = require("../../config/constant")
const maillogservice = require("../../services/User/maillogServices");
const sgMail = require('@sendgrid/mail');
const moment = require("moment");
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require("multer");
const { default: mongoose } = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const { default: axios } = require("axios");

const AWS = require('aws-sdk');
const ExcelJS = require('exceljs');

// Configure AWS S3
AWS.config.update({ region: 'us-east-1' });

const s3Client1 = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  },
})

const createExcelFileWithMultipleSheets = async (data, bucketName, folderName, dateString, role) => {
  const workbook = new ExcelJS.Workbook();
  // Loop through data to create sheets dynamically
  data.forEach((sheetData, index) => {
    let sheetName;

    if (role == "Super Admin") {
      if (index == 0) {
        sheetName = "summary"
      }
      if (index == 1) {
        sheetName = "dealer"
      }
      if (index == 2) {
        sheetName = "servicer"
      }
      if (index == 3) {
        sheetName = "reseller"
      }
      if (index == 4) {
        sheetName = "customer"
      }
    }
    if (role == "Dealer") {
      if (index == 0) {
        sheetName = "summary"
      }
      if (index == 1) {
        sheetName = "servicer"
      }
      if (index == 2) {
        sheetName = "reseller"
      }
      if (index == 3) {
        sheetName = "customer"
      }
    }
    if (role == "Reseller") {
      if (index == 0) {
        sheetName = "summary"
      }
      if (index == 1) {
        sheetName = "dealer"
      }
      if (index == 2) {
        sheetName = "servicer"
      }
      if (index == 3) {
        sheetName = "customer"
      }
    }
    if (role == "Servicer") {
      if (index == 0) {
        sheetName = "summary"
      }
      if (index == 1) {
        sheetName = "customer"
      }
      if (index == 2) {
        sheetName = "dealer"
      }
      if (index == 3) {
        sheetName = "reseller"
      }
    }
    if (role == "Customer") {

      if (index == 0) {
        sheetName = "customer"
      }
    }

    if (role == "paid") {
      console.log("role===================================", role)

      if (index == 0) {
        sheetName = "detail"
      }
    }

    const sheet = workbook.addWorksheet(`${sheetName}`);
    console.log("role===================================", role)

    if (sheetData.length > 0) {

      const headers = Object.keys(sheetData[0]); // Get keys from the first object as column headers
      sheet.columns = headers.map(header => ({ header, key: header }));
      // console.log("role=============eeeeeeee======================", sheet)

      // Add rows to the sheet
      sheetData.forEach(row => {
        sheet.addRow(row);
      });
    }
  });

  // Write workbook to buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Upload the file to the S3 bucket
  const s3Key = `${folderName}/claim-report-${dateString}.xlsx`;

  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  console.log(params);


  try {
    const uploadResponse = await s3Client1.send(new PutObjectCommand(params));

    console.log('Upload successful');
    return uploadResponse; // Return response from upload
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

const createExcelFileWithMultipleSheets1 = async (data, bucketName, folderName, dateString, role) => {
  console.log("Input data:", JSON.stringify(data, null, 2));
  console.log("Role:", role);

  const workbook = new ExcelJS.Workbook();

  data.forEach((sheetData, index) => {
    let sheetName = `Sheet${index + 1}`;
    if (role === "paid" && index === 0) {
      sheetName = "detail";
    }

    console.log(`Creating sheet: ${sheetName}`);
    const sheet = workbook.addWorksheet(sheetName);

    if (sheetData.length > 0) {
      const headers = Object.keys(sheetData[0]);
      sheet.columns = headers.map((header) => ({ header, key: header }));

      sheetData.forEach((row) => {
        const formattedRow = { ...row };
        if (formattedRow.approveDate) {
          formattedRow.approveDate = new Date(formattedRow.approveDate).toISOString();
        }

        console.log("Adding row:", formattedRow);
        sheet.addRow(formattedRow);
      });
    } else {
      console.log(`Sheet ${sheetName} has no data.`);
    }
  });

  // Write workbook locally for debugging
  // await workbook.xlsx.writeFile(`./debug-claim-report-${dateString}.xlsx`);
  console.log("Workbook written locally for debugging.");

  // Prepare S3 upload
  const buffer = await workbook.xlsx.writeBuffer();
  const s3Key = `${folderName}/claim-report-${dateString}.xlsx`;

  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  console.log("S3 upload parameters:", params);

  try {
    const uploadResponse = await s3Client1.send(new PutObjectCommand(params));
    console.log('Upload successful:', uploadResponse);
    return uploadResponse;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

exports.exportDataForClaim = async (req, res) => {
  try {

    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = 1000000
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    let match1 = {};
    let servicerMatch = {}
    let dealerMatch = {}
    let resellerMatch = {}
    let dateMatch = {}
    // checking the user type from token
    // checking the user type from token
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }

    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      match = { servicerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (req.role == 'Reseller') {
      match = { resellerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (data.flag == "Dealer") {
      match1 = { dealerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "Reseller") {
      match1 = { resellerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "Servicer") {
      match1 = { servicerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "Customer") {
      match1 = { customerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "Contract") {
      match1 = { contractId: new mongoose.Types.ObjectId(data.userId) }

    }

    if (req.role == 'Reseller') {
      match = { resellerId: new mongoose.Types.ObjectId(req.userId) }
      if (data.flag == "Servicer") {
        let getServicer = await servicerService.getServicerByName({ resellerId: data.userId })
        match1 = { servicerId: new mongoose.Types.ObjectId(getServicer?._id) }
        match = {}

      }
    }

    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
      if (data.flag == "Servicer") {
        let getServicer = await servicerService.getServicerByName({ dealerId: data.userId })
        match1 = { servicerId: new mongoose.Types.ObjectId(getServicer?._id) }
        match = {}

      }
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
              submittedBy: 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              dealerSku: 1,
              customerStatus: 1,
              trackingNumber: 1,
              claimPaymentStatus: 1,
              trackingType: 1,
              getcoverOverAmount: 1,
              customerOverAmount: 1,
              customerClaimAmount: 1,
              getCoverClaimAmount: 1,
              claimType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.productValue": 1,
              "contracts.claimAmount": 1,
              "contracts.coverageType": 1,
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
              "contracts.orders.customer._id": 1,
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
    data.servicerName = data.servicerName ? data.servicerName : ""
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
    data.dealerName = data.dealerName ? data.dealerName : ""
    data.resellerName = data.resellerName ? data.resellerName : ""
    data.dateFilter = data.dateFilter ? data.dateFilter : ""
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

    statusMatch = {}
    if (data.dateFilter != "") {
      let newEndDate = new Date(data.endDate)
      newEndDate.setHours(23, 59, 59, 999);
      if (data.dateFilter == "damageDate") {
        dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "openDate") {
        dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "closeDate") {
        dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
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
            servicerMatch,
            dealerMatch,
            resellerMatch,
            dateMatch,
            statusMatch,
            match1
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
    console.log("filtered data +++++++++++++++++", allClaims)
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
    //service call from claim services
    let allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

    let result_Array = resultFiter.map((item1) => {
      servicer = []
      let mergedData = []

      let servicerName = ''
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


      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        if (req.role == "Servicer") {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else if (req.role == "Dealer" && selfServicer) {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else if (req.role == "Reseller" && selfResellerServicer) {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else {
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
          );
        }

      }

      return {
        ...item1,
        servicerData: servicerName,
        selfResellerServicer: selfResellerServicer,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer,
          mergedData: mergedData
        }
      }
    })

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0 // getting the total count 
    let getTheThresholdLimit = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

    result_Array = await Promise.all(
      result_Array.map(async (claimObject) => {
        const { productValue, claimAmount } = claimObject.contracts;
        let query;
        claimObject.contracts.orders.customer.username = claimObject.contracts.orders.customer.username
        // if (req.role == "Customer") {
        //   if (claimObject?.submittedBy != '') {
        //     query = { email: claimObject?.submittedBy }
        //   }
        //   else {
        //     query = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: claimObject.contracts.orders.customer._id, isPrimary: true } } })

        //   }
        //   const customerDetail = await userService.getUserById1(query)
        //   claimObject.contracts.orders.customer.username = customerDetail?.metaData[0]?.firstName + " " + customerDetail?.metaData[0]?.lastName
        // }

        // Simulate an async operation if needed (e.g., fetching data)
        const thresholdLimitValue = (getTheThresholdLimit?.threshHoldLimit.value / 100) * productValue;


        // Check if claimAmount exceeds the threshold limit value
        let overThreshold = claimAmount > thresholdLimitValue;
        let threshHoldMessage = "Claim amount exceeds the allowed limit. This might lead to claim rejection. To proceed further with claim please contact admin.";
        if (!overThreshold) {
          threshHoldMessage = "";
        }
        if (claimObject.claimStatus.status === "rejected") {
          threshHoldMessage = "";
        }
        if (!getTheThresholdLimit.isThreshHoldLimit) {
          overThreshold = false;
          threshHoldMessage = "";
        }

        // Return the updated object with the new key 'overThreshold'
        return {
          ...claimObject,
          overThreshold,
          threshHoldMessage,
        };
      })
    );
    let dateString = Date.now()

    let dataForClaimReporting = {
      fileName: "claim-report-" + dateString,
      userId: req.teammateId,
      filePath: "claimReporting/claim-report-" + dateString + ".xlsx",
      date: new Date(),
      status: "Pending",
      reportName: data.reportName,
      remark: data.remark,
      category: "Claim"
    }
    let createReporting = await claimReportingService.createReporting(dataForClaimReporting)
    res.send({
      code: constant.successCode,
      message: "Success",
      result_Array, lookupQuery
    })

    const groupByRole = (resultArray, roleKey, roleName) => {
      const groupedData = resultArray.reduce((acc, item) => {
        // Extract dealer name and claim information
        const dealerName = roleKey.split('.').reduce((obj, key) => (obj ? obj[key] : null), item)?.name || `Unknown ${roleName}`;
        const claimAmount = item.claimStatus.some(status => status.status === "completed")
          ? item.totalAmount || 0
          : 0;
        const isCompleted = item.claimStatus.some(status => status.status === "completed");
        const isRejected = item.claimStatus.some(status => status.status === "rejected");
        const isOpen = item.claimStatus.some(status => status.status === "open");

        // Check if dealer already exists in the accumulator
        let dealerEntry = acc.find(entry => entry["Dealer Name"] === dealerName);

        if (!dealerEntry) {
          // If dealer does not exist, create a new entry
          dealerEntry = {
            "Dealer Name": dealerName,
            "Total Claims": 0,
            "Completed Claims": 0,
            "Open Claims": 0,
            "Rejected Claims": 0,
            "Total Amount of Claims": 0,
            "Average Claim Amount": 0, // Initialize average claim amount
          };
          acc.push(dealerEntry);
        }

        // Update dealer entry
        dealerEntry["Total Claims"] += 1;
        dealerEntry["Total Amount of Claims"] += claimAmount;
        if (isCompleted) {
          dealerEntry["Completed Claims"] += 1;
        }
        if (isRejected) {
          dealerEntry["Rejected Claims"] += 1;
        }
        if (isOpen) {
          dealerEntry["Open Claims"] += 1;
        }

        return acc;
      }, []);

      // Calculate average claim amount for each dealer based on completed claims
      groupedData.forEach(entry => {
        entry["Average Claim Amount"] = entry["Completed Claims"]
          ? (entry["Total Amount of Claims"] / entry["Completed Claims"]).toFixed(2)
          : 0;
      });

      return groupedData;
    };

    const groupDataByCustomer = (resultArray) => {
      return resultArray.reduce((acc, item) => {
        // Extract customer username and claim information
        const customerName = item?.contracts?.orders?.customer?.username || "Unknown Customer";
        const claimAmount = item.claimStatus.some(status => status.status === "completed")
          ? item.totalAmount || 0
          : 0;
        const isCompleted = item.claimStatus.some(status => status.status === "completed");
        const isOpen = item.claimStatus.some(status => status.status === "open");
        const isRejected = item.claimStatus.some(status => status.status === "rejected");

        // Check if customer already exists in the accumulator
        let customerEntry = acc.find(entry => entry["Customer Name"] === customerName);

        if (!customerEntry) {
          // If customer does not exist, create a new entry
          customerEntry = {
            "Customer Name": customerName,
            "Total Claims": 0,
            "Completed Claims": 0,
            "Open Claims": 0,
            "Rejected Claims": 0,
            "Total Amount of Claims": 0,
            "Average Claim Amount": 0, // Initialize average claim amount
          };
          if (req.role == "Customer") {
            customerEntry = {
              "Customer Name": customerName,
              "Total Claims": 0,
              "Completed Claims": 0,
              "Open Claims": 0,
              "Rejected Claims": 0
            };
          }
          acc.push(customerEntry);
        }

        // Update customer entry
        customerEntry["Total Claims"] += 1;
        if (req.role != "Customer") {
          customerEntry["Total Amount of Claims"] += claimAmount;
        }
        if (isCompleted) {
          customerEntry["Completed Claims"] += 1;
        }
        if (isRejected) {
          customerEntry["Rejected Claims"] += 1;
        }
        if (isOpen) {
          customerEntry["Open Claims"] += 1;
        }

        // Calculate average claim amount for completed claims
        if (req.role != "Customer") {
          customerEntry["Average Claim Amount"] = customerEntry["Completed Claims"]
            ? (customerEntry["Total Amount of Claims"] / customerEntry["Completed Claims"]).toFixed(2)
            : 0;
        }


        return acc;
      }, []);
    };

    const groupDataByServicer = async (resultArray) => {
      const acc = [];

      for (const item of resultArray) {
        // Extract servicer name
        let servicerName = item?.servicerId;
        if (servicerName == null) {
          servicerName = new mongoose.Types.ObjectId('679f52b0c9d8100000000000')
        }

        try {
          const result = await servicerService.getServiceProviderById({
            $and: [
              {
                $or: [
                  { _id: servicerName },
                  { dealerId: servicerName },
                  { resellerId: servicerName },
                ]
              },
            ]
          });
          servicerName = result?.name;
        } catch (err) {
          console.error("Error fetching servicer name:", err);
          continue; // Skip this item if there's an error fetching servicer name
        }

        console.log("Servicer Name:", servicerName);

        // Only process entries with valid servicer names
        if (!servicerName) {
          continue; // Skip entries with no valid servicer name
        }

        const claimAmount = item.claimStatus.some(status => status.status === "completed")
          ? item.totalAmount || 0
          : 0;
        const isCompleted = item.claimStatus.some(status => status.status === "completed");
        const isOpen = item.claimStatus.some(status => status.status === "open");
        const isRejected = item.claimStatus.some(status => status.status === "rejected");

        // Categorize Paid and Unpaid Claims based on claimFile and claimPaymentStatus
        let paidClaims = 0;
        let unpaidClaims = 0;

        if (item.claimFile === "completed") {
          if (item.claimPaymentStatus === "Paid") {
            paidClaims = 1;
          } else if (item.claimPaymentStatus === "Unpaid") {
            unpaidClaims = 1;
          }
        }

        // Check if servicer already exists in the accumulator
        let servicerEntry = acc.find(entry => entry["Servicer Name"] === servicerName);

        if (!servicerEntry) {
          // If servicer does not exist, create a new entry
          servicerEntry = {
            "Servicer Name": servicerName,
            "Total Claims": 0,
            "Completed Claims": 0,
            "Open Claims": 0,
            "Rejected Claims": 0,
            "Paid Claims": 0,
            "Unpaid Claims": 0,
            "Total Amount of Claims": 0,
            "Average Claim Amount": 0, // Initialize average claim amount
          };
          acc.push(servicerEntry);
        }

        // Update servicer entry
        servicerEntry["Total Claims"] += 1;
        servicerEntry["Total Amount of Claims"] += claimAmount;

        if (isCompleted) {
          servicerEntry["Completed Claims"] += 1;
          servicerEntry["Paid Claims"] += paidClaims;
          servicerEntry["Unpaid Claims"] += unpaidClaims;
        }

        if (isRejected) {
          servicerEntry["Rejected Claims"] += 1;
        }

        if (isOpen) {
          servicerEntry["Open Claims"] += 1;
        }

        // Calculate average claim amount for completed claims
        servicerEntry["Average Claim Amount"] = servicerEntry["Completed Claims"]
          ? (servicerEntry["Total Amount of Claims"] / servicerEntry["Completed Claims"]).toFixed(2)
          : 0;
      }

      return acc;
    };

    const groupDataByReseller = (resultArray) => {
      return resultArray.reduce((acc, item) => {
        // Extract reseller name and claim information
        const resellerName = item?.contracts?.orders?.resellers?.[0]?.name;
        if (!resellerName) {
          // Skip this item if there's no reseller name
          return acc;
        }

        const claimAmount = item.claimStatus.some(status => status.status === "completed")
          ? item.totalAmount || 0
          : 0;
        const isCompleted = item.claimStatus.some(status => status.status === "completed");
        const isOpen = item.claimStatus.some(status => status.status === "open");
        const isRejected = item.claimStatus.some(status => status.status === "rejected");

        // Check if reseller already exists in the accumulator
        let resellerEntry = acc.find(entry => entry["Reseller Name"] === resellerName);

        if (!resellerEntry) {
          // If reseller does not exist, create a new entry
          resellerEntry = {
            "Reseller Name": resellerName,
            "Total Claims": 0,
            "Completed Claims": 0,
            "Open Claims": 0,
            "Rejected Claims": 0,
            "Total Amount of Claims": 0,
            "Average Claim Amount": 0, // Initialize average claim amount
          };
          acc.push(resellerEntry);
        }

        // Update reseller entry
        resellerEntry["Total Claims"] += 1;
        resellerEntry["Total Amount of Claims"] += claimAmount;
        if (isCompleted) {
          resellerEntry["Completed Claims"] += 1;
        }
        if (isRejected) {
          resellerEntry["Rejected Claims"] += 1;
        }
        if (isOpen) {
          resellerEntry["Open Claims"] += 1;
        }

        // Calculate average claim amount for completed claims
        resellerEntry["Average Claim Amount"] = resellerEntry["Completed Claims"]
          ? (resellerEntry["Total Amount of Claims"] / resellerEntry["Completed Claims"]).toFixed(2)
          : 0;

        return acc;
      }, []);
    };

    // Group data for Dealer, Servicer, Reseller, and Customer
    const dealerData = groupByRole(result_Array, "contracts.orders.dealers", "Dealer");
    const servicerData = await groupDataByServicer(result_Array);
    const resellerData = groupDataByReseller(result_Array);
    let customerArray = groupDataByCustomer(result_Array)
    let summary = result_Array.reduce(
      (acc, item) => {
        // Increment total claims
        acc["Total Claims"] += 1;

        // Check claim statuses
        const hasRejectedStatus = item.claimStatus.some(status => status.status === "rejected");
        const hasCompletedStatus = item.claimStatus.some(status => status.status === "completed");

        // Categorize claims
        if (hasRejectedStatus) {
          acc["Total Rejected Claims"] += 1;
        } else if (hasCompletedStatus) {
          acc["Total Completed Claims"] += 1;
        } else {
          acc["Total Open Claims"] += 1;
        }

        // Categorize paid and unpaid claims using claimPaymentStatus
        if (item.claimFile === "completed") {
          if (item.claimPaymentStatus === "Paid") {
            acc["Total Paid Claims"] += 1;
          } else if (item.claimPaymentStatus === "Unpaid") {
            acc["Total Unpaid Claims"] += 1;
          }
        }

        return acc;
      },
      {
        "Total Claims": 0,
        "Total Open Claims": 0,
        "Total Completed Claims": 0,
        "Total Rejected Claims": 0,
        "Total Paid Claims": 0,
        "Total Unpaid Claims": 0,
      }
    );

    summary = [summary]
    let dataArray = [summary, dealerData, servicerData, resellerData, customerArray]
    if (req.role == "Super Admin") {
      dataArray = [summary, dealerData, servicerData, resellerData, customerArray]
    }
    if (req.role == "Dealer") {
      dataArray = [dealerData, servicerData, resellerData, customerArray]
    }
    if (req.role == "Reseller") {
      dataArray = [resellerData, dealerData, servicerData, customerArray]
    }
    if (req.role == "Servicer") {
      dataArray = [servicerData, customerArray, dealerData, resellerData]
    }
    if (req.role == "Customer") {
      dataArray = [customerArray]
    }
    // let fileName = "claim-report-" + dateString

    await createExcelFileWithMultipleSheets(dataArray, process.env.bucket_name, 'claimReporting', dateString, req.role)
      .then((res) => {
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Active" }, { new: true })
      })
      .catch((err) => {
        console.log("err:---------", err)
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Failed" }, { new: true })

      })


  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getClaimReportings = async (req, res) => {
  try {
    let data = req.body
    data.category = data.category ? data.category : ""
    if (data.category == "All") {
      data.category = ""
    }

    let claimReportingQuery = {
      $and: [
        { userId: req.teammateId },
        { category: { '$regex': data.category ? data.category.replace(/\s+/g, ' ').trim() : '', "$options": "i" } },
      ]
    }

    let getClaimReporting = await claimReportingService.getClaimReportings(claimReportingQuery, { createdAt: -1 })
    if (!getClaimReporting) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the claim reportings"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaimReporting
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getClaimReporting = async (req, res) => {
  try {
    let data = req.body
    let getClaimReporting = await claimReportingService.getClaimReporting({ _id: req.params.reportingId })
    if (!getClaimReporting) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim reporting ID"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaimReporting
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.deleteClaimReporting = async (req, res) => {
  try {
    let data = req.body
    let getClaimReporting = await claimReportingService.getClaimReporting({ _id: req.params.reportingId })
    if (!getClaimReporting) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim reporting ID"
      })
      return;
    }
    let deleteClaimReporting = await claimReportingService.deleteReporting({ _id: req.params.reportingId })
    if (!deleteClaimReporting) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the claim reporting"
      })
      return
    }
    res.send({
      code: constant.successCode,
      message: "Successfully deleted the claim reporting"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateReportingDownloadTime = async (req, res) => {
  try {
    let data = req.body
    let checkId = await claimReportingService.getClaimReporting({ _id: req.params.reportingId })
    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim reporting ID"
      })
      return
    }
    let newValues = {
      $set: {
        lastDownloadTime: new Date()
      }
    }
    let updateReportingDownloadTime = await claimReportingService.updateReporting({ _id: req.params.reportingId }, newValues, { new: true })
    if (!updateReportingDownloadTime) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the download time"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: updateReportingDownloadTime
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.paidUnpaidClaimReporting = async (req, res) => {
  try {
    let data = req.body
    let dateQuery = {}
    const paidFlag = req.body.paidFlag == 1 ? 'Paid' : 'Unpaid'

    if (data.noOfDays) {
      let end = moment().endOf('day')
      // end.setHours(23, 59, 999, 0)
      const start = moment().subtract(data.noOfDays, 'days').startOf('day')
      dateQuery = {
        claimDate: {
          $gt: new Date(start),
          $lte: new Date(end),
        }
      }
    }

    let approveQuery = {}
    if (data.startDate != "" && data.endDate != "" && paidFlag == "Paid") {
      let start = new Date(data.startDate); // Replace with your start date
      data.endDate = new Date(data.endDate)
      data.endDate.setHours(23, 59, 999, 0)
      // Add one day to the end date
      // end.setDate(end.getDate() + 1);
      start.setDate(start.getDate() + 1);
      approveQuery = {
        approveDate: {
          $gte: new Date(start),
          $lte: new Date(data.endDate),
        }
      }

    }

    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 1000
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let servicerId = req.body.userId
    let checkServicer = await providerService.getServiceProviderById({
      $or: [
        { _id: req.body.userId },
        { resellerId: req.body.userId },
        { dealerId: req.body.userId },

      ]
    })
    let servicerIdToCheck = checkServicer._id
    let match = {};
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
      checkServicer = await providerService.getServiceProviderById({ dealerId: req.userId })
      servicerIdToCheck = checkServicer._id
      servicerId = req.userId

    }
    if (req.role == 'Reseller') {
      match = { 'contracts.orders.resellerId': new mongoose.Types.ObjectId(req.userId) }
      checkServicer = await providerService.getServiceProviderById({ resellerId: req.userId })
      servicerIdToCheck = checkServicer._id
      servicerId = req.userId

    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    let dateString = Date.now()

    let dataForClaimReporting = {
      fileName: "claim-report-" + dateString,
      userId: req.teammateId,
      filePath: "claimReporting/claim-report-" + dateString + ".xlsx",
      date: new Date(),
      status: "Pending",
      reportName: data.reportName,
      remark: data.remark,
      category: "Claim",
      subCategory: "Paid"
    }

    let createReporting = await claimReportingService.createReporting(dataForClaimReporting)


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
              // "contractId": 1,
              // "claimFile": 1,
              // "lossDate": 1,
              // "claimType": 1,
              // "receiptImage": 1,
              // reason: 1,
              // "unique_key": 1,
              // approveDate: 1,
              // totalAmount: 1,
              "Claim ID": "$unique_key",
              "Approve Date": {
                $dateToString: {
                  format: "%Y-%m-%d", // Format to show only the date
                  date: "$approveDate"  // The date field from your document
                }
              },
              "Total Amount": "$totalAmount",
              _id: 0
              // ClaimType: 1,
              // note: 1,
              // servicerId: 1,
              // getcoverOverAmount: 1,
              // customerOverAmount: 1,
              // approveDate: 1,
              // customerClaimAmount: 1,
              // getCoverClaimAmount: 1,
              // customerStatus: 1,
              // repairParts: 1,
              // diagnosis: 1,
              // dealerSku: 1,
              // claimDate: 1,
              // claimType: 1,
              // approveDate: 1,
              // claimStatus: 1,
              // claimPaymentStatus: 1,
              // repairStatus: 1,
              // "contracts.unique_key": 1,
              // "contracts.productName": 1,
              // "contracts.pName": 1,
              // "contracts.coverageType": 1,
              // "contracts.model": 1,
              // "contracts.coverageType": 1,
              // "contracts.manufacture": 1,
              // "contracts.serial": 1,
              // "contracts.orders.dealerId": 1,
              // trackingNumber: 1,
              // trackingType: 1,
              // "contracts.orders._id": 1,
              // "contracts.orders.servicerId": 1,
              // "contracts.orders.customerId": 1,
              // "contracts.orders.resellerId": 1,
              // "contracts.orders.dealers.name": 1,
              // "contracts.orders.dealers.isServicer": 1,
              // "contracts.orders.dealers._id": 1,
              // "contracts.orders.dealers.accountStatus": 1,
              // "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": {
              //   $map: {
              //     input: "$contracts.orders.dealers.dealerServicer",
              //     as: "dealerServicer",
              //     in: {
              //       "_id": "$$dealerServicer._id",
              //       "servicerId": "$$dealerServicer.servicerId",
              //     }
              //   }
              // },
              // "contracts.orders.servicers": {
              //   $map: {
              //     input: "$contracts.orders.servicers",
              //     as: "servicer",
              //     in: {
              //       "_id": "$$servicer._id",
              //       "name": "$$servicer.name",
              //     }
              //   }
              // },
              // "contracts.orders.resellers": {
              //   $map: {
              //     input: "$contracts.orders.resellers",
              //     as: "reseller",
              //     in: {
              //       "_id": "$$reseller._id",
              //       "name": "$$reseller.name",
              //       "isServicer": "$$reseller.isServicer",
              //       "status": "$$reseller.status"
              //     }
              //   }
              // }
            }
          },
        ]
      }
    })
    data.dealerName = data.dealerName ? data.dealerName : ""
    data.servicerName = data.servicerName ? data.servicerName : ""
    let servicerMatch = {}

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

    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },

            {
              $or: [
                { 'claimStatus.status': 'Completed' },
                { 'claimStatus.status': 'completed' },

              ]
            },

            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { claimPaymentStatus: paidFlag },
            dateQuery,
            approveQuery,
            { 'servicerId': { $in: [new mongoose.Types.ObjectId(servicerId), new mongoose.Types.ObjectId(servicerIdToCheck)] } }
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
    // resultFiter.forEach(item => {
    //   // Iterate over the dealerServicer array in each item
    //   item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
    //     // Push the servicerId to the allServicerIds array
    //     allServicerIds.push(dealer.servicerId);
    //   });
    // });

    //Get Dealer and Reseller Servicers
    let servicer;
    let servicerName = '';

    let allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })
    let result_Array = [resultFiter]
    // let result_Array = await Promise.all(resultFiter.map(async (item1) => {
    //   servicer = []
    //   let servicerName = '';
    //   item1.approveDate = item1?.approveDate ? item1.approveDate : ''
    //   let selfServicer = false;
    //   let mergedData = []
    //   if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
    //     mergedData = dynamicOption.value.filter(contract =>
    //       item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
    //     );
    //   }
    //   // let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
    //   //   const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
    //   //   servicer.push(dealerOfServicer)
    //   // });
    //   // if (item1.contracts.orders.servicers[0]?.length > 0) {
    //   //   servicer.unshift(item1.contracts.orders.servicers[0])
    //   // }


    //   // let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
    //   let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
    //   if (dealerResellerServicer.length > 0) {
    //     let dealerResellerServicer = await providerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
    //     servicer = servicer.concat(dealerResellerServicer);
    //   }

    //   // if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
    //   //   let checkDealerServicer = await providerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })
    //   //   servicer.push(checkDealerServicer)
    //   // }
    //   // if (item1.servicerId != null) {
    //   //   servicerName = servicer.find(servicer => servicer._id?.toString() === item1.servicerId?.toString());
    //   //   const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
    //   //   selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
    //   // }
    //   return {
    //     ...item1,
    //     servicerData: servicerName,
    //     selfServicer: selfServicer,
    //     contracts: {
    //       ...item1.contracts,
    //       allServicer: servicer,
    //       mergedData: mergedData
    //     }
    //   }
    // }));


    console.log("checking the data _-------------------", result_Array)
    await createExcelFileWithMultipleSheets1(result_Array, process.env.bucket_name, 'claimReporting', dateString, "paid")
      .then((res) => {
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Active" }, { new: true })
      })
      .catch((err) => {
        console.log("err:---------", err)
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Failed" }, { new: true })

      })
    res.send({
      code: constant.successCode,
      message: "Success",
    })
    // res.send({
    //   code: constant.successCode,
    //   message: "Success",
    //   result: result_Array,
    // })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.stack
    })
  }
}

exports.getClaimDetails = async (req, res) => {
  try {
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    let match1 = {};
    let servicerMatch = {}
    let dealerMatch = {}
    let resellerMatch = {}
    let dateMatch = {}
    let dateString = new Date()
    // checking the user type from token
    if (req.role == 'Dealer') {
      match = { dealerId: new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { customerId: new mongoose.Types.ObjectId(req.userId) }
    }
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      match = { servicerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (req.role == 'Reseller') {
      match = { resellerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (data.flag == "dealer") {
      match1 = { dealerId: new mongoose.Types.ObjectId(data.userId) }
    }
    if (data.flag == "reseller") {
      match1 = { resellerId: new mongoose.Types.ObjectId(data.userId) }
    }
    if (data.flag == "servicer") {
      match1 = { servicerId: new mongoose.Types.ObjectId(data.userId) }
    }
    if (data.flag == "customer") {
      match1 = { customerId: new mongoose.Types.ObjectId(data.userId) }
    }


    let statusMatch = {}
    if (data.dateFilter != "") {
      let newEndDate = new Date(data.endDate)
      newEndDate.setHours(23, 59, 59, 999);
      if (data.dateFilter == "damageDate") {
        dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "openDate") {
        dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "closeDate") {
        dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
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
    data.servicerName = data.servicerName ? data.servicerName : ""
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

    const projection = {};

    // Loop through each field in req.body.projection and dynamically build the projection

    function formatFieldName(fieldName) {
      console.log("checking-------------", fieldName)
      return fieldName
        .replace(/([A-Z])/g, ' $1')   // Adds a space before each capital letter
        .replace(/^./, (str) => str.toUpperCase());  // Capitalizes the first letter
    }
    Object.keys(req.body.projection).forEach(field => {
      // Log the field if the value is 1 (inclusion)
      if (req.body.projection[field] === 1) {


        // Handle special fields that need transformation
        console.log(field)

        switch (field) {
          case 'dealerName':
            projection[field] = { $ifNull: [{ $arrayElemAt: ["$dealerDetail.name", 0] }, null] };
            break;
          case 'resellerName':
            projection[field] = { $ifNull: [{ $arrayElemAt: ["$resellerDetail.name", 0] }, null] };
            break;
          case 'servicerName':
            projection[field] = { $ifNull: [{ $arrayElemAt: ["$servicerDetail.name", 0] }, null] };
            break;
          case 'customerUsername':
            projection[field] = { $ifNull: [{ $arrayElemAt: ["$customerDetail.username", 0] }, null] };
            break;
          case 'contractId':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.contractId", 0] };
            break;
          case 'model':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.model", 0] };
            break;
          case 'manufacturer':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.manufacturer", 0] };
            break;
          case 'category':
            projection[field] = "$priceBookDetail.category";
            break;
          case 'description':
            projection[field] = "$priceBookDetail.description";
            break;
          case 'serial':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.serial", 0] };
            break;
          case 'dealerSku':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.dealerSku", 0] };
            break;
            case 'priceType':
              projection[field] = { $arrayElemAt: ["$contractDetail.priceType", 0] };
              break;
              case 'retailPrice':
                projection[field] = { $arrayElemAt: ["$contractDetail.retailPrice", 0] };
                break;
          case 'condition':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.condition", 0] };
            break;
          case 'coverageStartDate':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.coverageStartDate", 0] };
            break;
          case 'coverageEndDate':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.coverageEndDate", 0] };
            break;
          case 'partsWarrantyDate':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.partsWarrantyDate", 0] };
            break;
          case 'labourWarrantyDate':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.labourWarrantyDate", 0] };
            break;
          case 'purchaseDate':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.purchaseDate", 0] };
            break;
          case 'noOfClaimPerPeriod':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.noOfClaimPerPeriod", 0] };
            break;
          case 'noOfClaim':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.noOfClaim", 0] };
            break;
          case 'isManufacturerWarranty':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.isManufacturerWarranty", 0] };
            break;
          case 'isMaxClaimAmount':
            projection[field] = { $arrayElemAt: ["$contractDetail.contractDetail.isMaxClaimAmount", 0] };
            break;
          case 'productName':
            projection["Product Sku"] = "$productName";
            break;
          case 'shippingTo':
            projection["Customer Shipping Address"] = "$shippingTo";
            break;
          case 'pName':
            projection["Product Name"] = "$pName";
            break;

          case 'claimFile':
            projection["Claim Status"] = "$claimFile";
            break;
          case 'venderOrder':
            projection["Dealer Purchase Order #"] = "$venderOrder";
            break;
          case 'claimStatus':
            projection[field] = {
              $let: {
                vars: {
                  sortedStatuses: {
                    $sortArray: {
                      input: "$claimStatus", // Assuming the array is in the `statusDetails` field
                      sortBy: { date: -1 } // Sort by date in descending order
                    }
                  }
                },
                in: {
                  $ifNull: [{ $arrayElemAt: ["$$sortedStatuses.status", 0] }, null]
                }
              }
            };
            break;
          case 'customerStatus':
            projection[field] = {
              $let: {
                vars: {
                  sortedStatuses: {
                    $sortArray: {
                      input: "$customerStatus", // Assuming the array is in the `statusDetails` field
                      sortBy: { date: -1 } // Sort by date in descending order
                    }
                  }
                },
                in: {
                  $ifNull: [{ $arrayElemAt: ["$$sortedStatuses.status", 0] }, null]
                }
              }
            };
            break;
          case 'repairStatus':
            projection[field] = {
              $let: {
                vars: {
                  sortedStatuses: {
                    $sortArray: {
                      input: "$repairStatus", // Assuming the array is in the `statusDetails` field
                      sortBy: { date: -1 } // Sort by date in descending order
                    }
                  }
                },
                in: {
                  $ifNull: [{ $arrayElemAt: ["$$sortedStatuses.status", 0] }, null]
                }
              }
            };
            break;

          default:
            let field1 = field
            field1 = formatFieldName(field1)
            // For other fields, simply include them as-is
            projection[field1] = `${"$" + field}`;
        }
      }
    });


    let matchCondition = {
      $and: [
        { orderId: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
        { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'dealerSku': { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        servicerMatch,
        claimPaidStatus,
        dealerMatch,
        resellerMatch,
        dateMatch,
        statusMatch,
        match1
      ]
    }

    let lookupQuery = [
      {
        $match: matchCondition
      },
      {
        $lookup: {
          from: "dealers",
          foreignField: "_id",
          localField: "dealerId",
          as: "dealerDetail"
        }
      },
      {
        $lookup: {
          from: "resellers",
          foreignField: "_id",
          localField: "resellerId",
          as: "resellerDetail"
        }
      },
      {
        $lookup: {
          from: "serviceproviders",
          foreignField: "_id",
          localField: "servicerId",
          as: "servicerDetail"
        }
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "customerId",
          as: "customerDetail"
        }
      },
      {
        $lookup: {
          from: "pricebooks",
          foreignField: "name",
          localField: "productName",
          as: "priceBookDetail",
          pipeline: [
            {
              $lookup: {
                from: "pricecategories",
                localField: "category",
                foreignField: "_id",
                as: "pricecategory"
              }
            },
            {
              $project: {
                category: { $arrayElemAt: ["$pricecategory.name", 0] },
                description: 1,
                name: 1,
              }
            }
          ]
        }
      },
      {
        $unwind: { path: "$priceBookDetail", preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: "contracts",
          foreignField: "_id",
          localField: "contractId",
          as: "contractDetail",
          pipeline: [
            {
              $match: {
                unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }
              }
            },
            {
              $lookup: {
                from: "orders",  // Order collection
                localField: "orderProductId",
                foreignField: "productsArray._id",
                as: "orderData"
              }
            },
            { $unwind: "$orderData" },  // Unwind order data
            { $unwind: "$orderData.productsArray" },  // Unwind productsArray
            {
              $match: {
                $expr: { $eq: ["$orderProductId", "$orderData.productsArray._id"] }
              }
            },
            {
              $project: {
                orderId: "$orderData._id",
                productId: "$orderData.productsArray._id",
                priceType: "$orderData.productsArray.priceType",  // Fetching priceType
                contractDetail: "$$ROOT",
                retailPrice: {
                  $arrayElemAt: ["$orderData.productsArray.dealerPriceBookDetails.retailPrice", 0]
                }
              }
            }
          ]
        

        }
      },
      {
        $project: { ...projection, _id: 0 }
      }


    ]
    let dataForClaimReporting = {
      fileName: "claim-report-" + dateString,
      userId: req.teammateId,
      filePath: "claimReporting/claim-report-" + dateString + ".xlsx",
      date: new Date(),
      status: "Pending",
      reportName: data.reportName,
      remark: data.remark,
      category: "Claim",
      subCategory: "Claim Detail",
    }
    let createReporting = await claimReportingService.createReporting(dataForClaimReporting)
    // res.send({
    //   code: constant.successCode,
    //   message: "Success",
    //   result_Array, lookupQuery
    // })

    let getClaims = await claimService.getAllClaims(lookupQuery)

    await createExcelFileWithMultipleSheets1([getClaims], process.env.bucket_name, 'claimReporting', dateString, "paid")
      .then((res) => {
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Active" }, { new: true })
      })
      .catch((err) => {
        console.log("err:---------", err)
        claimReportingService.updateReporting({ _id: createReporting._id }, { status: "Failed" }, { new: true })

      })
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaims, lookupQuery
    })



  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}