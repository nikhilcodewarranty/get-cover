require("dotenv").config();

const contract = require("../../models/Contract/contract");
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
const constant = require("../../config/constant");
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
const path = require("path");
const AWS = require('aws-sdk');
const ExcelJS = require('exceljs');

// Configure AWS S3
AWS.config.update({ region: process.env.region });

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

        const sheet = workbook.addWorksheet(`${sheetName}`);

        if (sheetData.length > 0) {
            const headers = Object.keys(sheetData[0]); // Get keys from the first object as column headers
            sheet.columns = headers.map(header => ({ header, key: header }));

            // Add rows to the sheet
            sheetData.forEach(row => {
                sheet.addRow(row);
            });
        }
    });

    // Write workbook to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Upload the file to the S3 bucket
    const s3Key = `${folderName}/contract-report-${dateString}.xlsx`;

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

exports.exportContractReporting = async (req, res) => {
    try {
        let data = req.body
        let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })
        const limit = 1000; // Adjust the limit based on your needs
        let page = data.page > 0 ? ((Number(req.body.page) - 1) * Number(limit)) : 0
        data.pageLimit = 1000
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        // let pageLimit = Number(req.body.pageLimit) || 10; // Default to 10 if pageLimit is not provided
        let skipLimit = req.body.page > 0 ? (Number(req.body.page) - 1) * pageLimit : 0;
        let totalContractData = []
        let hasMore = true;
        let limitData = Number(limit)
        let dealerIds = [];
        let customerIds = [];
        let resellerIds = [];
        let dateString = Date.now()
        let orderIds = []
        let servicerIds = [];
        let userSearchCheck = 0

        if (req.role == 'Dealer') {
            // match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
            dealerIds = [new mongoose.Types.ObjectId(req.userId)]
        }
        if (req.role == 'Customer') {
            match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
            customerIds = [new mongoose.Types.ObjectId(req.userId)]
        }
        if (req.role == 'Servicer') {
            servicerIds = [new mongoose.Types.ObjectId(req.userId)]
            // match = { servicerId: new mongoose.Types.ObjectId(req.userId) }
        }
        if (req.role == 'Reseller') {
            // match = { resellerId: new mongoose.Types.ObjectId(req.userId) }
            resellerIds = [new mongoose.Types.ObjectId(req.userId)]

        }

        if (data.flag == "dealer") {
            dealerIds = [new mongoose.Types.ObjectId(data.userId)]

        }
        if (data.flag == "reseller") {
            resellerIds = [new mongoose.Types.ObjectId(data.userId)]

        }
        if (data.flag == "servicer") {
            servicerIds = [new mongoose.Types.ObjectId(data.userId)]

        }
        if (data.flag == "customer") {
            // match1 = { customerId: new mongoose.Types.ObjectId(data.userId) }
            customerIds = [new mongoose.Types.ObjectId(data.userId)]

        }
        if (data.flag == "order") {
            // match1 = { customerId: new mongoose.Types.ObjectId(data.userId) }
            orderIds = [new mongoose.Types.ObjectId(data.userId)]
        }

        if (data.dealerName != "") {
            userSearchCheck = 1
            let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                dealerIds = await getData.map(dealer => dealer._id)
            } else {
                dealerIds.push("1111121ccf9d400000000000")
            }
        };

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
                let asServicer = (await getData).reduce((acc, servicer) => {
                    if (servicer.resellerId !== null && servicer.dealerId === null) {
                        acc.push(servicer.resellerId);
                    } else if (servicer.dealerId !== null && servicer.resellerId === null) {
                        acc.push(servicer.dealerId);
                    }
                    return acc;
                }, []);
                servicerIds = servicerIds.concat(asServicer)
            } else {
                servicerIds.push("1111121ccf9d400000000000")
            }
        };

        if (data.resellerName != "") {
            userSearchCheck = 1
            let getData = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                resellerIds = await getData.map(servicer => servicer._id)
            } else {
                resellerIds.push("1111121ccf9d400000000000")
            }
        };

        let dataForClaimReporting = {
            fileName: "contract-report-" + dateString,
            userId: req.teammateId,
            filePath: "contractReporting/contract-report-" + dateString + ".xlsx",
            date: new Date(),
            status: "Pending",
            reportName: data.reportName,
            remark: data.remark,
            category: "Contract Reporting"
        }
        let createReporting = await claimReportingService.createReporting(dataForClaimReporting)
        // res.send({
        //     code: constant.successCode,
        //     message: "Success",
        //     // result: result1,
        // })

        let orderAndCondition = []

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
                orderIds = await getOrders.map(order => order._id)
            }
        }

        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { eligibilty: data.eligibilty === "true" ? true : false },
            ]
        } else {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        }

        if (userSearchCheck == 1) {
            contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
        }

        if (data.startDate != "") {
            let startDate = new Date(data.startDate)
            let endDate = new Date(data.endDate)
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(11, 59, 0, 0)
            let dateFilter = { createdAt: { $gte: startDate, $lte: endDate } }
            contractFilterWithEligibilty.push(dateFilter)
        }

        let mainQuery = []
        console.log("page+++++++++++++++++++++++++++++++++", skipLimit)

        while (hasMore) {
            // let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
            // let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
            if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
                mainQuery = [
                    { $sort: { unique_key_number: -1 } },
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

                            ],
                        },

                    },
                ]
            } else {
                mainQuery = [
                    { $sort: { unique_key_number: -1 } },
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
                    {
                        $match:
                        {
                            $and: contractFilterWithEligibilty
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
            // let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
            // var result1 = getContracts[0]?.data ? getContracts[0]?.data : []
            // console.log(result1.length, "================================")
            // res.send({
            //     result1
            // })
            // return;

            console.log("page+++++++++++++++++++++++++++++++++", skipLimit)
            let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
            var result1 = getContracts[0]?.data ? getContracts[0]?.data : []
            let totalRecords = getContracts[0]?.totalRecords?.[0]?.total || 0;
            // console.log(result1.length, getContracts[0]?.totalRecords, "================================")
            if (result1.length === 0 || skipLimit >= totalRecords) {
                hasMore = false;
                break;
            }

            totalContractData = totalContractData.concat(result1);
            skipLimit += pageLimit;

            console.log("checign main", totalContractData.length)
        }
        // let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
        // let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0
        // let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
        // return
        for (let e = 0; e < result1.length; e++) {
            result1[e].reason = " "
            if (!result1[e].eligibilty) {
                result1[e].reason = "Claims limit cross for this contract"
            }
            if (result1[e].status != "Active") {
                result1[e].reason = "Contract is not active"
            }

            if (new Date(result1[e].minDate) > new Date()) {
                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                };
                const formattedDate = new Date(result1[e].minDate).toLocaleDateString('en-US', options)
                result1[e].reason = "Contract will be eligible on " + " " + formattedDate
            }



            let claimQuery = [
                {
                    $match: { contractId: new mongoose.Types.ObjectId(result1[e]._id) }
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
                    result1[e].reason = "Contract has open claim"

                }
                if (checkClaims[0].totalAmount >= result1[e].productValue) {
                    result1[e].reason = "Claim value exceed the product value limit"
                }
            }

            let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
            const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
            let overThreshold = result1[e].claimAmount > thresholdLimitValue;
            let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
            if (!overThreshold) {
                threshHoldMessage = ""
            }
            if (!getTheThresholdLimir.isThreshHoldLimit) {
                overThreshold = false
                threshHoldMessage = ""
            }
            result1[e].threshHoldMessage = threshHoldMessage
            result1[e].overThreshold = overThreshold
        }


        const getDealerContractsSummary = (resultData) => {
            // Initialize a result array
            const result = [];

            resultData.forEach(item => {
                // Safely extract dealer information
                const dealer = item?.order?.[0]?.dealer?.[0];
                const dealerName = dealer?.name || "Unknown Dealer";

                // Optional fields: servicer and reseller
                const servicer = dealer?.servicer || "Unknown Servicer";
                const reseller = dealer?.reseller || "Unknown Reseller";

                // If no dealer object is found, skip this item
                if (!dealer) {
                    console.warn("Missing dealer information for item:", item);
                    return;
                }

                // Check if the dealer is already in the result
                let dealerEntry = result.find(entry => entry["Dealer Name"] === dealerName);

                // If not, create a new entry
                if (!dealerEntry) {
                    dealerEntry = {
                        "Dealer Name": dealerName,
                        "Total Contracts": 0,
                        "Waiting Contracts": 0,
                        "Active Contracts": 0,
                        "Expired Contracts": 0,
                    };
                    result.push(dealerEntry);
                }

                // Increment counts based on contract status
                dealerEntry["Total Contracts"] += 1;

                if (item.status === "Waiting") {
                    dealerEntry["Waiting Contracts"] += 1;
                } else if (item.status === "Active") {
                    dealerEntry["Active Contracts"] += 1;
                } else if (item.status === "Expired") {
                    dealerEntry["Expired Contracts"] += 1;
                }
            });

            return result;
        };


        const getServicerContractsSummary = (resultData) => {
            // Initialize a result array for servicers
            const result = [];

            resultData.forEach(item => {
                // Safely extract servicer information
                const servicer = item?.order?.[0]?.servicer?.[0];
                const servicerName = servicer?.name || "Unknown Servicer";

                // If no servicer object is found, skip this item
                if (!servicer) {
                    console.warn("Missing servicer information for item:", item);
                    return;
                }

                // Check if the servicer is already in the result
                let servicerEntry = result.find(entry => entry["Servicer Name"] === servicerName);

                // If not, create a new entry
                if (!servicerEntry) {
                    servicerEntry = {
                        "Servicer Name": servicerName,
                        "Total Contracts": 0,
                        "Waiting Contracts": 0,
                        "Active Contracts": 0,
                        "Expired Contracts": 0,
                    };
                    result.push(servicerEntry);
                }

                // Increment counts based on contract status
                servicerEntry["Total Contracts"] += 1;

                if (item.status === "Waiting") {
                    servicerEntry["Waiting Contracts"] += 1;
                } else if (item.status === "Active") {
                    servicerEntry["Active Contracts"] += 1;
                } else if (item.status === "Expired") {
                    servicerEntry["Expired Contracts"] += 1;
                }
            });

            return result;
        };

        const getResellerContractsSummary = (resultData) => {
            // Initialize a result array for resellers
            const result = [];

            resultData.forEach(item => {
                // Safely extract reseller information
                const reseller = item?.order?.[0]?.reseller?.[0];
                const resellerName = reseller?.name || "Unknown Reseller";

                // If no reseller object is found, skip this item
                if (!reseller) {
                    console.warn("Missing reseller information for item:", item);
                    return;
                }

                // Check if the reseller is already in the result
                let resellerEntry = result.find(entry => entry["Reseller Name"] === resellerName);

                // If not, create a new entry
                if (!resellerEntry) {
                    resellerEntry = {
                        "Reseller Name": resellerName,
                        "Total Contracts": 0,
                        "Waiting Contracts": 0,
                        "Active Contracts": 0,
                        "Expired Contracts": 0,
                    };
                    result.push(resellerEntry);
                }

                // Increment counts based on contract status
                resellerEntry["Total Contracts"] += 1;

                if (item.status === "Waiting") {
                    resellerEntry["Waiting Contracts"] += 1;
                } else if (item.status === "Active") {
                    resellerEntry["Active Contracts"] += 1;
                } else if (item.status === "Expired") {
                    resellerEntry["Expired Contracts"] += 1;
                }
            });

            return result;
        };


        const getCustomerContractsSummary = (resultData) => {
            // Initialize a result array for customers
            const result = [];

            resultData.forEach(item => {
                // Safely extract customer information
                const customer = item?.order?.[0]?.customer?.[0];
                const customerName = customer?.username || "Unknown Customer";

                // If no customer object is found, skip this item
                if (!customer) {
                    console.warn("Missing customer information for item:", item);
                    return;
                }

                // Check if the customer is already in the result
                let customerEntry = result.find(entry => entry["Customer Name"] === customerName);

                // If not, create a new entry
                if (!customerEntry) {
                    customerEntry = {
                        "Customer Name": customerName,
                        "Total Contracts": 0,
                        "Waiting Contracts": 0,
                        "Active Contracts": 0,
                        "Expired Contracts": 0,
                    };
                    result.push(customerEntry);
                }

                // Increment counts based on contract status
                customerEntry["Total Contracts"] += 1;

                if (item.status === "Waiting") {
                    customerEntry["Waiting Contracts"] += 1;
                } else if (item.status === "Active") {
                    customerEntry["Active Contracts"] += 1;
                } else if (item.status === "Expired") {
                    customerEntry["Expired Contracts"] += 1;
                }
            });

            return result;
        };


        let getContractsSummary = (resultData) => {
            // Initialize a summary object
            const summary = {
                "Total Contracts": 0,
                "Waiting Contracts": 0,
                "Active Contracts": 0,
                "Expired Contracts": 0,
            };

            resultData.forEach(item => {
                // Increment counts based on contract status
                summary["Total Contracts"] += 1;
                if (item.status === "Waiting") {
                    summary["Waiting Contracts"] += 1;
                } else if (item.status === "Active") {
                    summary["Active Contracts"] += 1;
                } else if (item.status === "Expired") {
                    summary["Expired Contracts"] += 1;
                }
            });

            return summary;
        };

        // result1 = totalContractData
        // Example Usage
        const dealerSummary = getDealerContractsSummary(totalContractData);
        const servicerSummary = getServicerContractsSummary(totalContractData);
        const resellerSummary = getResellerContractsSummary(totalContractData);
        const customerSummary = getCustomerContractsSummary(totalContractData);
        let Summary = getContractsSummary(totalContractData);


        let dataArray = [Summary, dealerSummary, servicerSummary, resellerSummary, customerSummary]
        Summary = [Summary]
        if (req.role == "Super Admin") {
            dataArray = [Summary, dealerSummary, servicerSummary, resellerSummary, customerSummary]
        }
        if (req.role == "Dealer") {
            dataArray = [dealerSummary, servicerSummary, resellerSummary, customerSummary]
        }
        if (req.role == "Reseller") {
            dataArray = [resellerSummary, dealerSummary, servicerSummary, customerSummary]
        }
        if (req.role == "Servicer") {
            dataArray = [servicerSummary, customerSummary, dealerSummary, resellerSummary]
        }
        if (req.role == "Customer") {
            dataArray = [customerSummary]
        }


        res.send({
            code: constant.successCode,
            message: "Success",
            // result: result1,
        })
        await createExcelFileWithMultipleSheets(dataArray, process.env.bucket_name, 'contractReporting', dateString, req.role)
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
            message: err.stack
        })
    }
};

