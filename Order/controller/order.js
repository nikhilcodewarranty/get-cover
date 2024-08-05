const { Order } = require("../model/order");
require("dotenv").config()
const orderResourceResponse = require("../utils/constant");
const pdf = require('html-pdf');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const orderService = require("../services/orderService");
const supportingFunction = require('../../config/supportingFunction')
const LOG = require('../../User/model/logs')
const emailConstant = require('../../config/emailConstant');

// const contractService = require("../../Contract/services/contractService");
const dealerService = require("../../Dealer/services/dealerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const resellerService = require("../../Dealer/services/resellerService");
const servicerService = require("../../Provider/services/providerService");
const contractService = require("../../Contract/services/contractService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const XLSX = require("xlsx");
const fs = require("fs");
const moment = require("moment");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const userService = require("../../User/services/userService");

const PDFDocument = require('pdfkit');
const claimService = require("../../Claim/services/claimService");

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

const folderName = 'orderFile'; // Replace with your specific folder name

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

const Storage = multerS3({
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


var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array("file", 100);

var uploadP = multer({
    storage: Storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).single("file");




// Create Order
exports.createOrder1 = async (req, res) => {
    try {
        let data = req.body;
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        data.resellerId = data.resellerId == 'null' ? null : data.resellerId;
        data.venderOrder = data.dealerPurchaseOrder;
        let projection = { isDeleted: 0 };

        let checkDealer = await dealerService.getDealerById(
            data.dealerId,
            projection
        );

        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found",
            });
            return;
        }

        if (!checkDealer.status) {
            res.send({
                code: constant.errorCode,
                message: "Order can not be created, due to the dealer is inactive",
            });
            return;
        }

        if (data.servicerId) {
            let query = {
                $or: [
                    { _id: data.servicerId },
                    { resellerId: data.servicerId },
                    { dealerId: data.servicerId },
                ],
            };

            let checkServicer = await servicerService.getServiceProviderById(query);
            if (!checkServicer) {
                res.send({
                    code: constant.errorCode,
                    message: "Servicer not found",
                });
                return;
            }
        }

        if (data.customerId) {
            let query = { _id: data.customerId };
            let checkCustomer = await customerService.getCustomerById(query);
            if (!checkCustomer) {
                res.send({
                    code: constant.errorCode,
                    message: "Customer not found",
                });
                return;
            }
        }
        if (data.priceBookId) {
            let query = { _id: data.priceBookId };
            let checkPriceBook = await priceBookService.findByName1(query);
            if (!checkPriceBook) {
                res.send({
                    code: constant.errorCode,
                    message: "PriceBook not found",
                });
                return;
            }
        }
        
        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;
        let count = await orderService.getOrdersCount();

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + "2024" + data.unique_key_number
        data.unique_key = "GC-" + "2024-" + data.unique_key_number

        let checkVenderOrder = await orderService.getOrder(
            { venderOrder: data.dealerPurchaseOrder, dealerId: data.dealerId },
            {}
        );
        if (checkVenderOrder) {
            res.send({
                code: constant.errorCode,
                message: "dealer purchase order is already exist",
            });
            return;
        }

        data.status = "Pending";
        if (data.paymentStatus == "Paid") {
            data.paidAmount = data.orderAmount
            data.dueAmount = 0
        }

        if (data.billTo == "Dealer") {
            let getUser = await userService.getSingleUserByEmail({ accountId: checkDealer._id, isPrimary: true })
            data.billDetail = {
                billTo: "Dealer",
                detail: {
                    name: checkDealer.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: checkDealer.street + ' , ' + checkDealer.city + ' , ' + checkDealer.country + ' , ' + checkDealer.zip

                }
            }
        }
        if (data.billTo == "Reseller") {
            let getReseller = await resellerService.getReseller({ _id: data.resellerId })
            let getUser = await userService.getSingleUserByEmail({ accountId: getReseller._id, isPrimary: true })
            data.billDetail = {
                billTo: "Reseller",
                detail: {
                    name: getReseller.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: getReseller.street + ' , ' + getReseller.city + ' , ' + getReseller.country + ' , ' + getReseller.zip

                }
            }
        }
        if (data.billTo == "Custom") {
            data.billDetail = {
                billTo: "Custom",
                detail: {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address

                }
            }
        }

        let serviceCoverage = '';
        if (req.body.serviceCoverageType == "Labour") {
            serviceCoverage = "Labor"
        }
        if (req.body.serviceCoverageType == "Parts & Labour") {
            serviceCoverage = "Parts & Labor"
        }

        data.serviceCoverageType = serviceCoverage != '' ? serviceCoverage : req.body.serviceCoverageType
        let savedResponse = await orderService.addOrder(data);
        if (!savedResponse) {
            let logData = {
                endpoint: "order/createOrder",
                body: data,
                userId: req.userId,
                response: {
                    code: constant.errorCode,
                    message: "unable to create order",
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "unable to create order",
            });
            return;
        }
        let returnField = [];

        var checkOrder = await orderService.getOrder(
            { _id: savedResponse._id },
        );

        let resultArray = checkOrder.productsArray.map(
            (item) => item.coverageStartDate === null
        );

        let isEmptyOrderFile = checkOrder.productsArray
            .map(
                (item) =>
                    item.orderFile.fileName === ""
            )

        // Update Term and condtion while create order
        let uploadTermAndCondtion = await orderService.updateOrder(
            { _id: checkOrder._id },
            { termCondition: checkDealer?.termCondition },
            { new: true }
        );

        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);
        //send notification to admin and dealer 
        let IDs = await supportingFunction.getUserIds()
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: data.dealerId, isPrimary: true })
        IDs.push(getPrimary._id)

        let notificationData = {
            title: "New order created",
            description: "The new order " + savedResponse.unique_key + " has been created",
            userId: req.teammateId,
            contentId: null,
            flag: 'order',
            redirectionId: savedResponse.unique_key,
            notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);

        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        let emailData = {
            senderName: getPrimary.firstName,
            content: "The new order " + checkOrder.unique_key + "  has been created for " + getPrimary.firstName + "",
            subject: "New Order"
        }


        let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let paidDate = {
                name: "processOrder",
                date: new Date()
            }
            let updatePaidDate = await orderService.updateOrder(
                { _id: checkOrder._id },
                { paidDate: paidDate },
                { new: true }
            );

            let count1 = await contractService.getContractsCountNew();
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            var pricebookDetail = []
            let checkLength = savedResponse.productsArray.length - 1
            let mapOnProducts = savedResponse.productsArray.map(async (product, index) => {
                if (data.adh && isNaN(data.adh)) {

                    res.send({
                        code: contact.errorCode,
                        message: "Order is created successfully,but unable to create the contract due to the invalid ADH day"
                    })
                    return
                }

                let pricebookDetailObject = {}
                let dealerPriceBookObject = {}
                pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
                pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
                pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
                pricebookDetailObject._id = product?.priceBookDetails._id
                pricebookDetailObject.name = product?.priceBookDetails.name
                pricebookDetailObject.categoryId = product?.priceBookDetails.category
                pricebookDetailObject.term = product?.priceBookDetails.term
                pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
                pricebookDetailObject.price = product.price
                pricebookDetailObject.noOfProducts = product.checkNumberProducts

                pricebookDetailObject.retailPrice = product.unitPrice
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails.brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails._id
                pricebookDetail.push(pricebookDetailObject)

                const readOpts = { // <--- need these settings in readFile options
                    cellDates: true
                };

                const jsonOpts = {
                    defval: '',
                    raw: false,
                    dateNF: '"m"/"d"/"yyyy"' // <--- need dateNF in sheet_to_json options (note the escape chars)
                }
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                let priceBookId = product.priceBookId;
                let coverageStartDate = product.coverageStartDate;
                let coverageEndDate = product.coverageEndDate;
                let orderProductId = product._id;
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                let projection = { isDeleted: 0 };
                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                const wb = XLSX.readFile(pathFile, readOpts);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
                const totalDataComing1 = XLSX.utils.sheet_to_json(ws, jsonOpts);
                const totalDataComing = totalDataComing1.map((item) => {
                    const keys = Object.keys(item);
                    return {
                        brand: item[keys[0]],
                        model: item[keys[1]],
                        serial: item[keys[2]],
                        condition: item[keys[3]],
                        retailValue: item[keys[4]],
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                var contractArray = [];

                let dealerBookDetail = []

                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, priceBook: priceBookId })


                totalDataComing.forEach((data, index1) => {
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + "2024" + unique_key_number1
                    let unique_key1 = "OC-" + "2024-" + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                    claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                    // -------------------------------------------------  copy from -----------------------------------------//

                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh != '' ? Number(product.adh) : 0 : 0)
                    let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                    let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                    dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + Number(adhDays)))
                    let p_date = new Date(data.purchaseDate)
                    let p_date1 = new Date(data.purchaseDate)
                    let l_date = new Date(data.purchaseDate)
                    let l_date1 = new Date(data.purchaseDate)
                    let purchaseMonth = p_date.getMonth();
                    let monthsPart = partWarrantyMonth;
                    let newPartMonth = purchaseMonth + monthsPart;

                    let monthsLabour = labourWarrantyMonth;
                    let newLabourMonth = purchaseMonth + monthsLabour;

                    let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
                    let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
                    let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
                    let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
                    //---------------------------------------- till here ----------------------------------------------
                    function findMinDate(d1, d2, d3) {

                        return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));
                    }
                    // Find the minimum date
                    let minDate;


                    if (req.body.coverageType == "Breakdown") {
                        if (req.body.serviceCoverageType == "Labour" || req.body.serviceCoverageType == "Labor") {
                            minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                        } else if (req.body.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        } else {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    } else if (req.body.coverageType == "Accidental") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                    } else {
                        if (req.body.serviceCoverageType == "Labour" || req.body.serviceCoverageType == "Labor") {

                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                        } else if (req.body.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        } else {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    }

                    // let eligibilty = new Date(dateCheck) < new Date() ? true : false
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false

                    //reporting codes 
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderUniqueKey: savedResponse.unique_key,
                        minDate: minDate,
                        venderOrder: savedResponse.venderOrder,
                        orderProductId: orderProductId,
                        coverageStartDate: coverageStartDate,
                        coverageEndDate: coverageEndDate,
                        productName: priceBook[0]?.name,
                        pName: priceBook[0]?.pName,
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: new Date(partsWarrantyDate1),
                        serviceCoverageType: serviceCoverage,
                        coverageType: req.body.coverageType,
                        labourWarranty: new Date(labourWarrantyDate1),
                        purchaseDate: new Date(data.purchaseDate),
                        serial: data.serial,
                        status: claimStatus,
                        eligibilty: eligibilty,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };

                    increamentNumber++

                    contractArray.push(contractObject);
                });

                let saveContracts = await contractService.createBulkContracts(contractArray);
                if (saveContracts.length == 0) {
                    let logData = {
                        endpoint: "order/createOrder",
                        body: data,
                        userId: req.userId,
                        response: {
                            code: constant.errorCode,
                            message: "Something went wrong in creating the contract",
                            saveContracts
                        }
                    }
                    await LOG(logData).save()
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Pending" },
                        { new: true }
                    );
                    res.send({
                        code: constant.errorCode,
                        message: "Something went wrong in creating the contract",
                    });
                    return
                }
                if (saveContracts[0]) {
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Active" },
                        { new: true }
                    );
                    //generate T anc C
                    if (checkDealer?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }
                    //send notification to admin and dealer 
                    let IDs = await supportingFunction.getUserIds()
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: data.dealerId, isPrimary: true })
                    let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: data.customerId, isPrimary: true })
                    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: data.resellerId, isPrimary: true })
                    if (resellerPrimary) {
                        IDs.push(resellerPrimary._id)
                    }
                    IDs.push(dealerPrimary._id, customerPrimary._id)
                    let notificationData1 = {
                        title: "Order Update and Processed",
                        description: "The  order " + checkOrder.unique_key + " has been updated and processed",
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        redirectionId: checkOrder.unique_key,
                        flag: 'order',
                        notificationFor: IDs
                    };

                    let createNotification = await userService.createNotification(notificationData1);
                    // Send Email code here
                    let notificationEmails = await supportingFunction.getUserEmails();
                    //Email to Dealer
                    let emailData = {
                        senderName: dealerPrimary.firstName,
                        content: "The  order " + checkOrder.unique_key + " has been updated and processed",
                        subject: "Process Order"
                    }

                    let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
                    //Email to Reseller
                    emailData = {
                        senderName: resellerPrimary?.firstName,
                        content: "The  order " + checkOrder.unique_key + " has been updated and processed",
                        subject: "Process Order"
                    }

                    mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
                    let logData = {
                        endpoint: "order/createOrder",
                        body: data,
                        userId: req.userId,
                        response: {
                            code: constant.successCode,
                            message: "Success",
                            saveContracts
                        }
                    }

                    await LOG(logData).save()
                    //reporting codes 
                    let getPriceBookDetail = await priceBookService.findByName1({ _id: priceBookId })
                    if (index == checkLength) {

                        let reportingData = {
                            orderId: savedResponse._id,
                            products: pricebookDetail,
                            orderAmount: data.orderAmount,
                            dealerId: data.dealerId,
                        }

                        await supportingFunction.reportingData(reportingData)
                    }
                }
            })
            let checkOrder2 = await orderService.getOrder(
                { _id: savedResponse._id },
            );

            res.send({
                code: constant.successCode,
                message: "Success",
            });
            return

        } else {
            let logData = {
                endpoint: "order/createOrder",
                body: data,
                userId: req.userId,
                response: {
                    code: constant.successCode,
                    message: "Success",
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        }
    } catch (err) {
        let logData = {
            endpoint: "order/createOrder catch",
            body: req.body,
            userId: req.userId,
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
};

//process order for checking pending requirements
exports.processOrder = async (req, res) => {
    try {
        let returnField = [];
        let checkOrder = await orderService.getOrder(
            { _id: req.params.orderId },
            { isDeleted: 0 }
        );

        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: "Order not found!",
            });
            return;
        }

        let resultArray = checkOrder.productsArray.map(
            (item) => item.coverageStartDate === null
        );
        let isEmptyOrderFile = checkOrder.productsArray
            .map(
                (item) =>
                    item.orderFile.fileName === "" && item.orderFile.name === ""
            )

        if (checkOrder.customerId == '' || checkOrder.customerId == null) {
            returnField.push('Customer Name')
        }

        if (checkOrder.paymentStatus != 'Paid') {
            returnField.push('Order payment')
        }
        if (resultArray.includes(true)) {
            returnField.push('Coverage start date')
        }

        if (isEmptyOrderFile.includes(true)) {
            returnField.push('Product data file')
        }

        const combinedString = returnField.length > 0 ? returnField.join(', ') + ' is missing' : '';
        res.send({
            code: constant.successCode,
            message: "Success!",
            result: combinedString,
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Get All Orders
exports.getAllOrders = async (req, res) => {
    try {

        let data = req.body;
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action",
            });
            return;
        }

        let query = { status: { $ne: "Archieved" } };
        let lookupQuery = [
            {
                $match: query
            },
            {
                "$addFields": {
                    "noOfProducts": {
                        "$sum": "$productsArray.checkNumberProducts"
                    },
                    totalOrderAmount: { $sum: "$orderAmount" },

                }
            },
            { $sort: { unique_key: -1 } }
        ]

        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 10000000000
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId?.toString());

        let mergedArray = userDealerIds.concat(userResellerIds);

        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        //Get Respective Dealers
        let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
            name: 1,
            isServicer: 1,
            city: 1,
            state: 1,
            country: 1,
            zip: 1,
            street: 1

        });
        let servicerIdArray = ordersResult.map((result) => result.servicerId);
        const servicerCreteria = {
            $or: [
                { _id: { $in: servicerIdArray } },
                { resellerId: { $in: servicerIdArray } },
                { dealerId: { $in: servicerIdArray } },
            ],
        };
        //Get Respective Servicer
        let respectiveServicer = await servicerService.getAllServiceProvider(
            servicerCreteria,
            {
                name: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1,
                dealerId: 1,
                resellerId: 1
            }
        );
        let customerIdsArray = ordersResult.map((result) => result.customerId);
        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId?.toString());

        const customerCreteria = { _id: { $in: customerIdsArray } };

        const allUserIds = mergedArray.concat(userCustomerIds);

        const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
        //Get Respective Customer
        let respectiveCustomer = await customerService.getAllCustomers(
            customerCreteria,
            {
                username: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1
            }
        );
        //Get all Reseller

        let resellerIdsArray = ordersResult.map((result) => result.resellerId);
        const resellerCreteria = { _id: { $in: resellerIdsArray } };
        let respectiveReseller = await resellerService.getResellers(
            resellerCreteria,
            {
                name: 1,
                isServicer: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1
            }
        );

        const result_Array = ordersResult.map((item1) => {
            const dealerName =
                item1.dealerId != ""
                    ? respectiveDealers.find(
                        (item2) => item2._id.toString() === item1.dealerId.toString()
                    )
                    : null;
            const servicerName =
                item1.servicerId != null
                    ? respectiveServicer.find(
                        (item2) =>
                            item2._id.toString() === item1.servicerId?.toString() ||
                            item2.resellerId?.toString() === item1?.servicerId?.toString() || item2.dealerId?.toString() === item1?.servicerId?.toString()
                    )
                    : null;
            const customerName =
                item1.customerId != null
                    ? respectiveCustomer.find(
                        (item2) => item2._id.toString() === item1?.customerId.toString()
                    )
                    : null;
            const resellerName =
                item1.resellerId != null
                    ? respectiveReseller.find(
                        (item2) => item2._id.toString() === item1.resellerId?.toString()
                    )
                    : null;

            if (dealerName || customerName || servicerName || resellerName) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    dealerName: dealerName ? dealerName.toObject() : {},
                    servicerName: servicerName ? servicerName.toObject() : {},
                    customerName: customerName ? customerName.toObject() : {},
                    resellerName: resellerName ? resellerName.toObject() : {},
                };
            } else {
                return {
                    dealerName: {},
                    servicerName: {},
                    customerName: {},
                    resellerName: {},
                };
            }
        });

        const unique_keyRegex = new RegExp(
            data.unique_key ? data.unique_key.replace(/\s+/g, ' ').trim() : "",
            "i"
        );
        const venderOrderRegex = new RegExp(
            data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : "",
            "i"
        );
        const status = new RegExp(data.status ? data.status.replace(/\s+/g, ' ').trim() : "", "i");

        let filteredData = result_Array.filter((entry) => {
            return (
                unique_keyRegex.test(entry.unique_key) &&
                venderOrderRegex.test(entry.venderOrder) &&
                status.test(entry.status)
            );
        });

        const updatedArray = filteredData.map((item, index) => {
            let isEmptyStartDate = item.productsArray.map(
                (item1) => item1.coverageStartDate === null
            );
            let isEmptyOrderFile = item.productsArray
                .map(
                    (item1) =>
                        item1.orderFile.fileName === ""
                )
            item.flag = false
            const coverageStartDate = isEmptyStartDate.includes(true) ? false : true
            const fileName = isEmptyOrderFile.includes(true) ? false : true
            if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
                item.flag = true
            }
            let username = null; // Initialize username as null
            let resellerUsername = null; // Initialize username as null
            let customerUserData = null; // Initialize username as null
            if (item.dealerName._id) {
                username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
            }
            if (item.resellerName._id) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.resellerName._id.toString()) : {};
            }
            if (item.customerName._id) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.customerName._id.toString()) : {};
            }
            return {
                ...item,
                servicerName: (item.dealerName.isServicer && item.servicerId?.toString() == item.dealerName._id?.toString()) ? item.dealerName : (item?.resellerName?.isServicer && item?.servicerId?.toString() == item?.resellerName?._id?.toString()) ? item.resellerName : item?.servicerName,
                username: username, // Set username based on the conditional checks
                resellerUsername: resellerUsername ? resellerUsername : {},
                customerUserData: customerUserData ? customerUserData : {}
            };
        });


        let orderIdSearch = data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : ''
        const stringWithoutHyphen = orderIdSearch.replace(/-/g, "").trim()
        const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen : '', 'i')
        const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const statusRegex = new RegExp(data.status ? data.status : '', 'i')

        const filteredData1 = updatedArray.filter(entry => {
            return (
                venderRegex.test(entry.venderOrder) &&
                orderIdRegex.test(entry.unique_key_search) &&
                dealerNameRegex.test(entry.dealerName.name) &&
                servicerNameRegex.test(entry.servicerName.name) &&
                customerNameRegex.test(entry.customerName.username) &&
                resellerNameRegex.test(entry.resellerName.name) &&
                statusRegex.test(entry.status)
            );
        });


        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData1,
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get All archieve orders
exports.getAllArchieveOrders = async (req, res) => {
    let data = req.body;
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action",
        });
        return;
    }

    let query = { status: { $eq: "Archieved" } };

    let lookupQuery = [
        {
            $match: query
        },
        {
            "$addFields": {
                "noOfProducts": {
                    "$sum": "$productsArray.checkNumberProducts"
                },
                totalOrderAmount: { $sum: "$orderAmount" },
            }
        },

        { $sort: { unique_key: -1 } }
    ]

    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)

    let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
    let dealerIdsArray = ordersResult.map((result) => result.dealerId);
    const dealerCreateria = { _id: { $in: dealerIdsArray } };
    //Get Respective Dealers
    let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
        name: 1,
        isServicer: 1,
    });
    let servicerIdArray = ordersResult.map((result) => result.servicerId);
    const servicerCreteria = {
        $or: [
            { _id: { $in: servicerIdArray } },
            { resellerId: { $in: servicerIdArray } },
            { dealerId: { $in: servicerIdArray } },
        ],
    };
    //Get Respective Servicer
    let respectiveServicer = await servicerService.getAllServiceProvider(
        servicerCreteria,
        { name: 1 }
    );
    let customerIdsArray = ordersResult.map((result) => result.customerId);
    const customerCreteria = { _id: { $in: customerIdsArray } };
    //Get Respective Customer
    let respectiveCustomer = await customerService.getAllCustomers(
        customerCreteria,
        { username: 1 }
    );
    //Get all Reseller
    let resellerIdsArray = ordersResult.map((result) => result.resellerId);
    const resellerCreteria = { _id: { $in: resellerIdsArray } };
    let respectiveReseller = await resellerService.getResellers(
        resellerCreteria,
        { name: 1, isServicer: 1 }
    );
    const result_Array = ordersResult.map((item1) => {
        const dealerName =
            item1.dealerId != ""
                ? respectiveDealers.find(
                    (item2) => item2._id.toString() === item1.dealerId.toString()
                )
                : null;
        const servicerName =
            item1.servicerId != null
                ? respectiveServicer.find(
                    (item2) =>
                        item2._id.toString() === item1.servicerId.toString() ||
                        item2.resellerId === item1.servicerId
                )
                : null;
        const customerName =
            item1.customerId != null
                ? respectiveCustomer.find(
                    (item2) => item2._id.toString() === item1.customerId.toString()
                )
                : null;
        const resellerName =
            item1.resellerId != null
                ? respectiveReseller.find(
                    (item2) => item2._id.toString() === item1.resellerId.toString()
                )
                : null;
        if (dealerName || customerName || servicerName || resellerName) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                dealerName: dealerName ? dealerName.toObject() : {},
                servicerName: servicerName ? servicerName.toObject() : {},
                customerName: customerName ? customerName.toObject() : {},
                resellerName: resellerName ? resellerName.toObject() : {},
            };
        } else {
            return {
                dealerName: dealerName ? dealerName.toObject() : {},
                servicerName: servicerName ? servicerName.toObject() : {},
                customerName: customerName ? customerName.toObject() : {},
                resellerName: resellerName ? resellerName.toObject() : {},
            };
        }
    });

    const unique_keyRegex = new RegExp(
        data.unique_key ? data.unique_key.replace(/\s+/g, ' ').trim() : "",
        "i"
    );
    const venderOrderRegex = new RegExp(
        data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : "",
        "i"
    );
    const status = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : "", "i");

    let filteredData = result_Array.filter((entry) => {
        return (
            unique_keyRegex.test(entry.unique_key) &&
            venderOrderRegex.test(entry.venderOrder) &&
            status.test(entry.status)
        );
    });

    const updatedArray = filteredData.map((item) => ({
        ...item,
        servicerName: item.dealerName.isServicer
            ? item.dealerName
            : item.resellerName.isServicer
                ? item.resellerName
                : item.servicerName,
    }));
    const orderIdRegex = new RegExp(data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', 'i')
    const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const statusRegex = new RegExp(data.status ? data.status : '', 'i')

    const filteredData1 = updatedArray.filter(entry => {
        return (
            venderRegex.test(entry.venderOrder) &&
            orderIdRegex.test(entry.unique_key) &&
            dealerNameRegex.test(entry.dealerName.name) &&
            servicerNameRegex.test(entry.servicerName.name) &&
            customerNameRegex.test(entry.customerName.name) &&
            resellerNameRegex.test(entry.resellerName.name) &&
            statusRegex.test(entry.status)
        );
    });
    res.send({
        code: constant.successCode,
        message: "Success",
        result: filteredData1,
    });
};

exports.checkFileValidation = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            let data = req.body;
            let file = req.file;
            let csvName = req.file.filename;
            let originalName = req.file.originalname;
            let size = req.file.size;
            const csvWriter = createCsvWriter({
                path: "./uploads/resultFile/" + csvName,
                header: [
                    { id: "Brand", title: "Brand" },
                    { id: "Model", title: "Model" },
                    { id: "Serial", title: "Serial" },
                    { id: "Class", title: "Class" },
                    { id: "Condition", title: "Condition" },
                    { id: "Retail Value", title: "Retail Value" },
                    // Add more headers as needed
                ],
            });
            const fileUrl = req.file.destination + '/' + req.file.filename
            const wb = XLSX.readFile(fileUrl);
            const sheets = wb.SheetNames;
            const ws = wb.Sheets[sheets[0]];
            let message = [];
            const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
            const headers = [];
            for (let cell in ws) {
                // Check if the cell is in the first row and has a non-empty value
                if (
                    /^[A-Z]1$/.test(cell) &&
                    ws[cell].v !== undefined &&
                    ws[cell].v !== null &&
                    ws[cell].v.trim() !== ""
                ) {
                    headers.push(ws[cell].v);
                }
            }

            if (headers.length !== 8) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.successCode,
                    message:
                        "Invalid file format detected. The sheet should contain exactly eight columns.",
                    orderFile: {
                        fileName: csvName,
                        name: originalName,
                        size: size,
                    },
                });
                return;
            }

            const isValidLength = totalDataComing1.every(
                (obj) => Object.keys(obj).length === 5
            );
            if (!isValidLength) {
                res.send({
                    code: constant.successCode,
                    message: "Invalid fields value",
                    orderFile: {
                        fileName: csvName,
                        name: originalName,
                        size: size,
                    },
                });
                return;
            }
            const totalDataComing = totalDataComing1.map((item) => {
                const keys = Object.keys(item);
                return {
                    retailValue: item[keys[4]],
                };
            });


            const serialNumberArray = totalDataComing1.map((item) => {
                const keys = Object.keys(item);
                return {
                    serial: item[keys[2]].toString().toLowerCase(),
                };
            });

            const serialNumbers = serialNumberArray.map(number => number.serial);
            const duplicateSerials = serialNumbers.filter((serial, index) => serialNumbers.indexOf(serial) !== index);

            if (duplicateSerials.length > 0) {
                res.send({
                    code: constant.successCode,
                    message: "Serial numbers are not unique for this product",
                    orderFile: {
                        fileName: csvName,
                        name: originalName,
                        size: size,
                    },
                })
                return
            }

            // Check retail price is in between rangeStart and rangeEnd
            const isValidRetailPrice = totalDataComing.map((obj) => {
                // Check if 'noOfProducts' matches the length of 'data'
                if (
                    obj.retailValue < Number(data.rangeStart) ||
                    obj.retailValue > Number(data.rangeEnd)
                ) {
                    message.push({
                        code: constant.successCode,
                        retailPrice: obj.retailValue,
                        message: "Invalid Retail Price!",
                        fileName: csvName,
                        name: originalName,
                        orderFile: {
                            fileName: csvName,
                            name: originalName,
                            size: size,
                        },
                    });
                }
            });

            if (message.length > 0) {
                res.send({
                    data: message,

                });
                return;
            }

            res.send({
                code: constant.successCode,
                message: "Verified",
                orderFile: {
                    fileName: csvName,
                    name: originalName,
                    size: size,
                },
            });
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//checking uploaded file is valid
exports.checkMultipleFileValidation = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body;
            if (data.productsArray.length > 0) {
                let fileIndex = 0;
                const productsWithFiles = data.productsArray.map((data1, index) => {
                    let file1 = undefined; // Initialize file to undefined
                    if (data1.fileValue == 'true') {
                        let checkFile = JSON.parse(data1.orderFile)
                        // Check if data1.file is not blank
                        file1 = process.env.LOCAL_FILE_PATH + "/" + checkFile.fileName;
                        fileIndex++;
                    }
                    return {
                        products: {
                            key: index,
                            checkNumberProducts: data1.checkNumberProducts,
                            noOfProducts: data1.noOfProducts,
                            priceType: data1.priceType,
                            rangeStart: data1.rangeStart,
                            rangeEnd: data1.rangeEnd,
                            flag: data1.fileValue, // Set flag based on whether data1.file is not blank
                            file: file1
                        },
                    };
                });
                let allHeaders = [];
                let allDataComing = [];
                let message = [];
                let finalRetailValue = [];
                //Collect all header length for all csv
                for (let j = 0; j < productsWithFiles.length; j++) {
                    if (productsWithFiles[j].products.file != undefined) {
                        const readOpts = { // <--- need these settings in readFile options
                            //cellText:false, 
                            cellDates: true
                        };

                        var jsonOpts = {
                            //header: 1,
                            defval: '',
                            // blankrows: true,
                            raw: false,
                            dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
                        }
                        const wb = XLSX.readFile(productsWithFiles[j].products.file, readOpts);
                        const sheets = wb.SheetNames;
                        const sheet = wb.Sheets[sheets[0]];
                        const headers = [];
                        for (let cell in sheet) {
                            // Check if the cell is in the first row and has a non-empty value
                            if (
                                /^[A-Z]1$/.test(cell) &&
                                sheet[cell].v !== undefined &&
                                sheet[cell].v !== null &&
                                sheet[cell].v.trim() !== ""
                            ) {
                                headers.push(sheet[cell].v);
                            }
                        }
                        allDataComing.push({
                            key: productsWithFiles[j].products.key,
                            checkNumberProducts:
                                productsWithFiles[j].products.checkNumberProducts,
                            noOfProducts: productsWithFiles[j].products.noOfProducts,
                            priceType: productsWithFiles[j].products.priceType,
                            rangeStart: productsWithFiles[j].products.rangeStart,
                            rangeEnd: productsWithFiles[j].products.rangeEnd,
                            data: XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], jsonOpts),
                        });
                        allHeaders.push({
                            key: productsWithFiles[j].products.key,
                            headers: headers,
                        });
                    }
                }

                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 8)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly eight columns.",
                    }));
                if (errorMessages.length > 0) {
                    // There are errors, send the error messages
                    res.send({
                        code: constant.errorCode,
                        message: errorMessages,
                    });
                    return;
                }
                if (allDataComing.length > 0) {
                    const isValidLength1 = allDataComing.map((obj) => {
                        if (!obj.data || typeof obj.data !== "object") {
                            return false; // 'data' should be an object
                        }

                        const orderFileData = obj.data.map(item => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        orderFileData.forEach((fileData) => {
                            let brand = fileData.brand.toString().replace(/\s+/g, ' ').trim()
                            let serial = fileData.serial.toString().replace(/\s+/g, ' ').trim()
                            let condition = fileData.condition.toString().replace(/\s+/g, ' ').trim()
                            let retailValue = fileData.retailValue.toString().replace(/\s+/g, ' ').trim()
                            let partsWarranty = fileData.partsWarranty.toString().replace(/\s+/g, ' ').trim()
                            let labourWarranty = fileData.labourWarranty.toString().replace(/\s+/g, ' ').trim()
                            let purchaseDate = fileData.purchaseDate.toString().replace(/\s+/g, ' ').trim()
                            let model = fileData.model.toString().replace(/\s+/g, ' ').trim()

                            if (brand == '' || serial == '' || condition == '' || retailValue == '' || model == '' || partsWarranty == '' || labourWarranty == '' || purchaseDate == "") {
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid fields value",
                                });

                                return;

                            }
                        });
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }
                    let serialNumber = allDataComing.map((obj) => {
                        const serialNumberArray = obj.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj.key,
                                serialNumber: item[keys[2]],
                                retailValue: item[keys[4]]
                            };
                        });

                        if (serialNumberArray.length > 0) {
                            const seen = new Set();
                            const duplicates = [];
                            for (const { key, serialNumber } of serialNumberArray) {
                                const keySerialPair = `${key}-${serialNumber}`;
                                if (seen.has(keySerialPair)) {
                                    message.push({
                                        code: 401,
                                        key: key,
                                        message: "Serial numbers are not unique for this product"
                                    });
                                    return
                                } else {
                                    seen.add(keySerialPair);

                                }
                            }
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                    //Check if csv data length equal to no of products
                    const isValidNumberData = allDataComing.map((obj) => {
                        if (obj.priceType == "Quantity Pricing") {
                            if (parseInt(obj.checkNumberProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                //return; // Set the return value to false when the condition fails
                            }
                        } else {
                            if (parseInt(obj.noOfProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                // return; // Set the return value to false when the condition fails
                            }
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let checkRetailValue = allDataComing.map((obj1) => {
                        const priceObj = obj1.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj1.key,
                                checkNumberProducts: obj1.checkNumberProducts,
                                noOfProducts: obj1.noOfProducts,
                                rangeStart: obj1.rangeStart,
                                rangeEnd: obj1.rangeEnd,
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        if (priceObj.length > 0) {
                            priceObj.map((obj, index) => {
                                if (isNaN(obj.retailValue) || obj.retailValue < 0) {
                                    {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Retail Price should be integer and positive!!",
                                        });

                                        return;
                                    }
                                }
                                // check if the input value is a number
                                let p_warranty = Number(obj.partsWarranty)
                                let l_warranty = Number(obj.labourWarranty)

                                if (!isNaN(p_warranty) || !isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(p_warranty) || isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(new Date(obj.purchaseDate).getTime())) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'Invalid Date!'
                                    });
                                    return;
                                }
                                if (new Date(obj.purchaseDate) > new Date()) {

                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'The purchase date should be present date and past date!'
                                    });
                                    return;
                                }
                                if (obj1.priceType == 'Flat Pricing') {
                                    if (Number(obj.retailValue) < Number(obj.rangeStart) || Number(obj.retailValue) > Number(obj.rangeEnd)) {
                                        {
                                            message.push({
                                                code: constant.errorCode,
                                                key: obj.key,
                                                message: "Retail price should be between start and end range!",
                                            });

                                            return;
                                        }
                                    }
                                }
                            });
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }
                }
            }



            res.send({
                code: constant.successCode,
                message: "SuccessfileName!",
            });
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.editFileCase = async (req, res) => {
    try {
        let data = req.body;
        let productsWithFiles = []
        if (data.productsArray.length > 0) {
            for (let i = 0; i < data.productsArray.length; i++) {
                if (Object.keys(data.productsArray[i]?.orderFile).length > 0 && data.productsArray[i]?.orderFile.fileName != '') {
                    let fileName = process.env.LOCAL_FILE_PATH + "/" + data.productsArray[i].orderFile.fileName
                    const readOpts = { // <--- need these settings in readFile options
                        //cellText:false, 
                        cellDates: true
                    };

                    var jsonOpts = {
                        //header: 1,
                        defval: '',
                        // blankrows: true,
                        raw: false,
                        dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
                    }
                    let product = {
                        key: i,
                        checkNumberProducts: data.productsArray[i].checkNumberProducts,
                        noOfProducts: data.productsArray[i].noOfProducts,
                        priceType: data.productsArray[i].priceType,
                        rangeStart: data.productsArray[i].rangeStart,
                        rangeEnd: data.productsArray[i].rangeEnd,
                        flag: data.productsArray[i].fileValue,
                        file: fileName
                    }

                    productsWithFiles.push(product)
                }
            }
            let allHeaders = [];
            let allDataComing = [];
            let message = [];
            let finalRetailValue = [];
            if (productsWithFiles.length > 0) {
                for (let j = 0; j < productsWithFiles.length; j++) {
                    if (productsWithFiles[j].file != undefined) {
                        const wb = XLSX.readFile(productsWithFiles[j].file, {
                            cellDates: true,
                        });
                        const sheets = wb.SheetNames;
                        const sheet = wb.Sheets[sheets[0]];
                        const headers = [];
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
                        allDataComing.push({
                            key: productsWithFiles[j].key,
                            checkNumberProducts:
                                productsWithFiles[j].checkNumberProducts,
                            noOfProducts: productsWithFiles[j].noOfProducts,
                            priceType: productsWithFiles[j].priceType,
                            rangeStart: productsWithFiles[j].rangeStart,
                            rangeEnd: productsWithFiles[j].rangeEnd,
                            data: XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], jsonOpts),
                        });
                        allHeaders.push({
                            key: productsWithFiles[j].key,
                            headers: headers,
                        });
                    }
                }

                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 8)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly eight columns.",
                    }));
                if (errorMessages.length > 0) {
                    // There are errors, send the error messages
                    res.send({
                        code: constant.errorCode,
                        message: errorMessages,
                    });
                    return;
                }

                if (allDataComing.length > 0) {
                    const isValidLength1 = allDataComing.map((obj) => {
                        if (!obj.data || typeof obj.data !== "object") {
                            return false; // 'data' should be an object
                        }

                        const orderFileData = obj.data.map(item => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        orderFileData.forEach((fileData) => {
                            let brand = fileData.brand.toString().replace(/\s+/g, ' ').trim()
                            let serial = fileData.serial.toString().replace(/\s+/g, ' ').trim()
                            let condition = fileData.condition.toString().replace(/\s+/g, ' ').trim()
                            let retailValue = fileData.retailValue.toString().replace(/\s+/g, ' ').trim()
                            let model = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let partsWarranty = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let labourWarranty = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let purchaseDate = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            if (brand == '' || serial == '' || condition == '' || retailValue == '' || model == '' || partsWarranty == '' || labourWarranty == '' || purchaseDate == '') {
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid fields value",
                                });

                                return;
                            }
                        });
                    });
                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let serialNumber = allDataComing.map((obj) => {
                        const serialNumberArray = obj.data.map((item) => {
                            const keys = Object.keys(item);
                            let serials = item[keys[2]].toString().toLowerCase()
                            return {
                                key: obj.key,
                                serialNumber: serials
                            };
                        });

                        if (serialNumberArray.length > 0) {
                            const seen = new Set();
                            const duplicates = [];

                            for (const { key, serialNumber } of serialNumberArray) {
                                const keySerialPair = `${key}-${serialNumber}`;
                                if (seen.has(keySerialPair)) {
                                    message.push({
                                        code: 401,
                                        key: key,
                                        message: "Serial numbers are not unique for this product"
                                    });
                                    return
                                } else {
                                    seen.add(keySerialPair);

                                }
                            }
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                    //Check if csv data length equal to no of products
                    const isValidNumberData = allDataComing.map((obj) => {
                        if (obj.priceType == "Quantity Pricing") {
                            if (parseInt(obj.checkNumberProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                //return; // Set the return value to false when the condition fails
                            }
                        } else {
                            if (parseInt(obj.noOfProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                // return; // Set the return value to false when the condition fails
                            }
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let checkRetailValue = allDataComing.map((obj1) => {
                        const priceObj = obj1.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj1.key,
                                checkNumberProducts: obj1.checkNumberProducts,
                                noOfProducts: obj1.noOfProducts,
                                rangeStart: obj1.rangeStart,
                                rangeEnd: obj1.rangeEnd,
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        if (priceObj.length > 0) {
                            priceObj.map((obj, index) => {
                                if (isNaN(obj.retailValue) || obj.retailValue < 0) {
                                    {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Retail Price should be integer and positive!!",
                                        });

                                        return;
                                    }
                                }
                                // check if the input value is a number
                                let p_warranty = Number(obj.partsWarranty)
                                let l_warranty = Number(obj.labourWarranty)
                                if (!isNaN(p_warranty) || !isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(p_warranty) || isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(new Date(obj.purchaseDate).getTime())) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'Invalid Date!'
                                    });
                                    return;
                                }
                                if (new Date(obj.purchaseDate) > new Date()) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'The purchase date should be present date and past date!'
                                    });
                                    return;
                                }
                                if (obj1.priceType == 'Flat Pricing') {
                                    if (Number(obj.retailValue) < Number(obj.rangeStart) || Number(obj.retailValue) > Number(obj.rangeEnd)) {
                                        {
                                            message.push({
                                                code: constant.errorCode,
                                                key: obj.key,
                                                message: "Retail price should be between start and end range!",
                                            });

                                            return;
                                        }
                                    }
                                }


                            });
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                }
            }
            res.send({
                code: constant.successCode,
                message: 'Success!',
                productDetail: req.body
            })
        }
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get customer for order
exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        if (data.resellerId != "" && data.resellerId != undefined) {
            query = { dealerId: data.dealerId, resellerId: data.resellerId };
        } else {
            query = { dealerId: data.dealerId };
        }
        let getCustomers = await customerService.getAllCustomers(query, {});

        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers",
            });
            return;
        }
        const customerIds = getCustomers.map(customer => customer._id.toString());
        let query1 = { accountId: { $in: customerIds }, isPrimary: true };
        let projection = { __v: 0, isDeleted: 0 }

        let customerUser = await userService.getMembers(query1, projection)

        const result_Array = customerUser.map(item1 => {
            const matchingItem = getCustomers.find(item2 => item2._id.toString() === item1.accountId.toString());
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(),
                    email: item1.email  // Use toObject() to convert Mongoose document to plain JavaScript object
                };
            } else {
                return {};
            }
        });

        res.send({
            code: constant.successCode,
            message: "Successfully Fetched",
            result: result_Array,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Get servicer in orders
exports.getServicerInOrders = async (req, res) => {
    let data = req.body;
    let servicer = [];
    if (data.dealerId) {
        var checkDealer = await dealerService.getDealerById(data.dealerId, {
            isDeleted: 0,
        });
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found!",
            });
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({
            dealerId: data.dealerId,
        });
        let ids = getServicersIds.map((item) => item.servicerId);

        servicer = await servicerService.getAllServiceProvider(
            { _id: { $in: ids }, status: true },
            {}
        );

        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers",
            });
            return;
        }
    }
    if (data.resellerId) {
        var checkReseller = await resellerService.getReseller({
            _id: data.resellerId,
        });
    }
    if (checkReseller && checkReseller.isServicer) {
        //Get the servicer name if reseller as servicer
        const checkServicer = await servicerService.getServiceProviderById({ resellerId: checkReseller._id })
        if (checkReseller.status) {
            servicer.unshift(checkReseller);
        }
    }

    if (checkDealer && checkDealer.isServicer) {
        //Get the servicer name if dealer as servicer
        const checkServicer = await servicerService.getServiceProviderById({ dealerId: checkDealer._id })
        if (checkDealer.accountStatus) {
            servicer.unshift(checkDealer);
        }
    }

    const servicerIds = servicer.map((obj) => obj?._id);
    const resellerIdss = servicer.map((obj) => obj?.resellerId);
    const dealerIdss = servicer.map((obj) => obj?.dealerId);
    const query1 = {
        $and: [
            {
                $or: [
                    { accountId: { $in: servicerIds } },
                    { accountId: { $in: resellerIdss } },
                    { accountId: { $in: dealerIdss } },
                ]
            },
            { isPrimary: true }
        ]
    };

    let servicerUser = await userService.getMembers(query1, {});
    if (!servicerUser) {
        res.send({
            code: constant.errorCode,
            message: "Unable to fetch the data",
        });
        return;
    }


    const result_Array = servicer.map((item1) => {
        const matchingItem = servicerUser.find(
            (item2) => item2.accountId.toString() === item1?._id.toString());
        let matchingItem2 = servicerUser.find(
            (item2) => item2.accountId.toString() === item1?.resellerId?.toString() || item2.accountId.toString() === item1?.dealerId?.toString());
        if (matchingItem) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem.toObject(),
            };
        } else if (matchingItem2) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem2.toObject(),
            };
        } else {
            return {}
        }
    });

    res.send({
        code: constant.successCode,
        result: result_Array,
    });
};
//Get Dealer Resellers
exports.getDealerResellers = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.body.dealerId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.body.dealerId, status: true }
        let projection = { __v: 0 }
        const resellers = await resellerService.getResellers(query, projection);
        if (!resellers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the resellers"
            });
            return;
        };


        const resellerId = resellers.map(obj => obj._id.toString());

        const orderResellerId = resellers.map(obj => obj._id);
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

        //Get Dealer Customer Orders

        let project = {
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            servicerId: 1,
            customerId: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            venderOrder: 1,
            orderAmount: 1,
        }

        let orderQuery = {
            $and: [
                { resellerId: { $in: orderResellerId }, status: "Active" },
            ]
        }
        let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$resellerId');

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.accountId)

            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orderData: order ? order : {}
                };
            } else {
                return {};
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.resellerData.dealerId) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getServicerByOrderId = async (req, res) => {
    try {
        let query = { _id: req.params.orderId }
        let checkOrder = await orderService.getOrder(query, { isDeleted: 0 })
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: 'Order not found!'
            });
            return;
        }

        let checkDealer = await dealerService.getDealerById(checkOrder.dealerId, {
            isDeleted: 0,
        })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found!",
            });
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({
            dealerId: checkOrder.dealerId,
        });
        let ids = getServicersIds.map((item) => item.servicerId);
        servicer = await servicerService.getAllServiceProvider(
            { _id: { $in: ids }, status: true },
            {}
        );
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers",
            });
            return;
        }
        if (checkOrder.resellerId != null) {
            var checkReseller = await resellerService.getReseller({
                _id: checkOrder.resellerId,
            });
        }
        if (checkReseller && checkReseller.isServicer) {
            servicer.unshift(checkReseller);
        }

        if (checkDealer && checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }
        const servicerIds = servicer.map((obj) => obj._id);
        const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

        let servicerUser = await userService.getMembers(query1, {});
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }

        const result_Array = servicer.map((item1) => {
            const matchingItem = servicerUser.find(
                (item2) => item2.accountId.toString() === item1._id.toString()
            );

            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: matchingItem.toObject(),
                };
            } else {
                return {};
            }
        });

        res.send({
            code: constant.successCode,
            result: result_Array,
        });

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get Service Coverage for order
exports.getServiceCoverage = async (req, res) => {
    try {
        let dealerId;
        if (req.role == 'Super Admin') {
            dealerId = req.params.dealerId
        }
        if (req.role == 'Dealer') {
            dealerId = req.userId
        }
        if (req.role == 'Reseller') {
            const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
            if (!checkReseller) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid Reseller."
                })
                return;
            }

            dealerId = checkReseller.dealerId
        }

        let data = req.body;
        let checkDealer = await dealerService.getDealerById(dealerId, {
            isDeleted: 0,
        })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found!",
            });
            return;
        }

        res.send({
            code: constant.successCode,
            result: checkDealer,
        });

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get Dealer price book and categories
exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body;
        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
            dealerId: req.params.dealerId,
            status: true,
        });
        if (!getDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }
        if (!data.coverageType) {
            res.send({
                code: constant.errorCode,
                message: "Coverage type is required",
            });
            return;
        }
        // price book ids array from dealer price book
        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);

        let query;
        if (data.term != "" && data.pName == "") {
            query = { _id: { $in: dealerPriceIds }, status: true, term: data.term, coverageType: data.coverageType };
        }
        else if (data.pName != "" && data.term == "") {
            query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, coverageType: data.coverageType };

        } else if (data.term != "" && data.pName != "") {
            query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term, coverageType: data.coverageType };
        } else {
            query = { _id: { $in: dealerPriceIds }, coverageType: data.coverageType, status: true, };
        }

        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {});
        if (data.priceBookId || data.priceBookId != "") {
            getPriceBooks = await priceBookService.getAllPriceIds({ _id: data.priceBookId }, {});
            data.term = getPriceBooks[0]?.term ? getPriceBooks[0].term : ""
            data.pName = getPriceBooks[0]?.pName ? getPriceBooks[0].pName : ""
        }

        const dealerPriceBookMap = new Map(
            getDealerPriceBook.map((item) => [
                item.priceBook.toString(),
                item.retailPrice,
            ])
        );

        // Update getPriceBook array with retailPrice from getDealerPriceBook
        let mergedPriceBooks = getPriceBooks.map((item) => {
            const retailPrice = dealerPriceBookMap.get(item._id.toString()) || 0;
            return {
                ...item._doc,
                retailPrice,
            };
        });


        //unique categories IDs from price books
        let uniqueCategory = {};
        let uniqueCategories = getPriceBooks.filter((item) => {
            if (!uniqueCategory[item.category.toString()]) {
                uniqueCategory[item.category.toString()] = true;
                return true;
            }
            return false;
        });

        uniqueCategories = uniqueCategories.map((item) => item.category);

        // get categories related to dealers
        let getCategories = await priceBookService.getAllPriceCat(
            { _id: { $in: uniqueCategories } },
            {}
        );

        // gettign selected category if user select the price book first
        let filteredPiceBook;
        let checkSelectedCategory;
        let dealerPriceBookDetail = {
            _id: "",
            priceBook: "",
            dealerId: "",
            status: "",
            retailPrice: "",
            description: "",
            isDeleted: "",
            brokerFee: "",
            unique_key: "",
            wholesalePrice: "",
            __v: 0,
            createdAt: "",
            updatedAt: "",
        };
        if (data.priceBookId || data.priceBookId != "") {
            filteredPiceBook = getPriceBooks
                .filter((item) => item._id.toString() === data.priceBookId)
                .map((item) => item.category);
            checkSelectedCategory = await priceBookService.getPriceCatByName({
                _id: filteredPiceBook,
            });

            dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({
                dealerId: req.params.dealerId,
                priceBook: data.priceBookId,
            });
        }

        if (data.priceCatId || data.priceCatId != "") {
            mergedPriceBooks = mergedPriceBooks.filter(
                (item) => item.category.toString() === data.priceCatId
            );
            checkSelectedCategory = await priceBookService.getPriceCatByName({
                _id: filteredPiceBook,
            });
        }

        const uniqueTerms = [...new Set(mergedPriceBooks.map(item => item.term))].map(term => ({
            label: Number(term) / 12 === 1 ? Number(term) / 12 + " Year" : Number(term) / 12 + " Years",
            value: term
        })).sort((a, b) => a.value - b.value)

        const uniqueProductName = [...new Set(mergedPriceBooks.map(item => item?.pName))].map(pName => ({
            pName: pName,
        }));
        let priceBookDetail
        if (mergedPriceBooks.length == 1) {
            priceBookDetail = mergedPriceBooks[0]
        } else {
            priceBookDetail = {}
        }

        let result = {
            priceCategories: getCategories,
            priceBooks: data.priceCatId == "" ? [] : mergedPriceBooks,
            productName: data.priceCatId == "" ? [] : uniqueProductName,
            terms: data.priceCatId == "" ? [] : uniqueTerms,
            selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
            dealerPriceBookDetail: dealerPriceBookDetail,
            priceBookDetail
        };

        res.send({
            code: constant.successCode,
            message: "Success",
            result: result,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Get Price Book in Order
exports.getPriceBooksInOrder = async (req, res) => {
    try {
        let data = req.body
        let query = {
            $and: [
                { dealerId: req.params.dealerId },
                { status: true, }
            ]
        }

        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice(query);

        if (!getDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }
        let dealerPriceBookDetail = {
            _id: "",
            priceBook: "",
            dealerId: "",
            status: "",
            retailPrice: "",
            description: "",
            isDeleted: "",
            brokerFee: "",
            unique_key: "",
            wholesalePrice: "",
            __v: 0,
            createdAt: "",
            updatedAt: "",
        };

        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
        let query1;

        if (data.term) {
            query1 = { _id: { $in: dealerPriceIds }, status: true, category: data.priceCatId, term: data.term };
        }
        else if (data.pName) {
            query1 = { _id: { $in: dealerPriceIds }, status: true, category: data.priceCatId, pName: data.pName };

        } else if (data.term && data.pName) {
            query1 = { _id: { $in: dealerPriceIds }, status: true, category: data.priceCatId, pName: data.pName, term: data.term };
        } else {
            query1 = { _id: { $in: dealerPriceIds }, coverageType: data.coverageType, status: true, category: data.priceCatId };
        }

        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query1, {});

        const dealerPriceBookMap = new Map(
            getDealerPriceBook.map((item) => [
                item.priceBook.toString(),
                item.retailPrice,
            ])
        );

        let mergedPriceBooks = getPriceBooks.map((item) => {
            const retailPrice = dealerPriceBookMap.get(item._id.toString()) || 0;
            return {
                ...item._doc,
                retailPrice,
            };
        });
        let filteredPiceBook;
        if (data.priceBookId || data.priceBookId != "") {
            filteredPiceBook = getPriceBooks
                .filter((item) => item._id.toString() === data.priceBookId)
                .map((item) => item.category);
            checkSelectedCategory = await priceBookService.getPriceCatByName({
                _id: filteredPiceBook,
            });

            dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({
                dealerId: req.params.dealerId,
                priceBook: data.priceBookId,
            });
        }

        let result = {
            priceBooks: mergedPriceBooks,
            dealerPriceBookDetail: dealerPriceBookDetail,
        };
        res.send({
            code: constant.successCode,
            message: "Success",
            result: result,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.messsage
        })
    }
}

//Check Purchase order
exports.checkPurchaseOrder = async (req, res) => {
    try {
        let checkPurchaseOrder;
        let data = req.body;
        if (
            data.oldDealerPurchaseOrder != "" &&
            data.oldDealerPurchaseOrder != data.dealerPurchaseOrder
        ) {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId ? req.body.dealerId : req.userId,
                },
                { isDeleted: 0 }
            );
        } else if (data.oldDealerPurchaseOrder == "") {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId ? req.body.dealerId : req.userId,
                },
                { isDeleted: 0 }
            );
        }

        if (checkPurchaseOrder) {
            res.send({
                code: constant.errorCode,
                message: "The order of this vendor number is already exist!",
            });
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success!",
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Archeive Order
exports.archiveOrder = async (req, res) => {
    try {
        let checkOrder = await orderService.getOrder(
            { _id: req.params.orderId },
            { isDeleted: 0 }
        );
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: "Order not found!",
            });

            return;
        }
        if (checkOrder.status == "Active") {
            res.send({
                code: constant.errorCode,
                message: "Order is already active",
            });

            return;
        }

        let updateStatus;
        if (checkOrder.status != 'Active') {
            updateStatus = await orderService.updateOrder(
                { _id: checkOrder._id },
                { status: "Archieved" },
                { new: true }
            );
            if (!updateStatus) {
                res.send({
                    code: constant.errorCode,
                    message: "Unable to archive this order!",
                });
                return;
            }
        }
        //send notification to dealer,reseller,admin,customer
        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
        let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
        let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.resellerId, isPrimary: true })
        if (resellerPrimary) {
            IDs.push(resellerPrimary._id)
        }
        if (customerPrimary) {
            IDs.push(customerPrimary._id)
        }
        IDs.push(dealerPrimary._id)
        let notificationData1 = {
            title: "Order Archieved",
            description: "The order " + checkOrder.unique_key + " has been archeived!.",
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'order',
            redirectionId: checkOrder.unique_key,
            notificationFor: IDs
        };
        let createNotification = await userService.createNotification(notificationData1);
        //Save Logs
        let logData = {
            endpoint: "order/archiveOrder",
            body: req.body,
            userId: req.userId,
            response: {
                code: constant.successCode,
                message: "Success!",
            }
        }
        await LOG(logData).save()
        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        let emailData = {
            senderName: dealerPrimary.firstName,
            content: "The order " + checkOrder.unique_key + " has been archeived!.",
            subject: "Archeive Order"
        }
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
        emailData = {
            senderName: resellerPrimary?.firstName,
            content: "The order " + checkOrder.unique_key + " has been archeived!.",
            subject: "Archeive Order"
        }
        mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
        //  }
        res.send({
            code: constant.successCode,
            message: "Success!",
        });
    } catch (err) {
        let logData = {
            endpoint: "order/archiveOrder",
            body: req.body,
            userId: req.userId,
            response: {
                code: constant.successCode,
                message: "Success!",
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });

        return;
    }
};

//Get single order
exports.getSingleOrder = async (req, res) => {
    try {
        let projection = { isDeleted: 0 };
        let query = { _id: req.params.orderId };
        let checkOrder = await orderService.getOrder(query, projection);
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: "Order not found!",
            });
            return;
        }
        checkOrder = checkOrder.toObject();
        checkOrder.productsArray = await Promise.all(checkOrder.productsArray.map(async (product) => {
            const pricebook = await priceBookService.findByName1({ _id: product.priceBookId });
            const pricebookCat = await priceBookService.getPriceCatByName({ _id: product.categoryId });
            if (pricebook) {
                product.name = pricebook.name;
                product.pName = pricebook.pName;
                product.term = pricebook.term;
            }
            if (pricebookCat) {
                product.catName = pricebookCat.name;
            }

            return product;
        }));

        // return
        //Get Dealer Data

        let dealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: 0 });

        //Get customer Data
        let customer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: 0 });
        //Get Reseller Data
        let reseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: 0 })
        //Get Servicer Data
        let query1 = {
            $or: [
                { _id: checkOrder.servicerId },
                { resellerId: checkOrder.servicerId != null ? checkOrder.servicerId : '' },
                { dealerId: checkOrder.servicerId != null ? checkOrder.servicerId : '' },
            ],
        };
        let checkServicer = await servicerService.getServiceProviderById(query1);
        let singleDealerUser = await userService.getUserById1({ accountId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false });
        let singleResellerUser = await userService.getUserById1({ accountId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false });
        let singleCustomerUser = await userService.getUserById1({ accountId: checkOrder.customerId, isPrimary: true }, { isDeleted: false });
        // ------------------------------------Get Dealer Servicer -----------------------------
        let getServicersIds = await dealerRelationService.getDealerRelations({
            dealerId: checkOrder.dealerId,
        });
        let ids = getServicersIds.map((item) => item.servicerId);
        servicer = await servicerService.getAllServiceProvider(
            { _id: { $in: ids }, status: true },
            {}
        );
        if (checkOrder.resellerId != null) {
            var checkReseller = await resellerService.getReseller({
                _id: checkOrder.resellerId,
            });
        }
        if (reseller && reseller.isServicer) {
            if (reseller.status) {
                servicer.unshift(reseller);
            }
        }

        if (dealer && dealer.isServicer) {
            if (dealer.accountStatus) {
                servicer.unshift(dealer);
            }
            //servicer.unshift(dealer);
        }
        const servicerIds = servicer.map((obj) => obj._id);
        const servicerQuery = { accountId: { $in: servicerIds }, isPrimary: true };

        let servicerUser = await userService.getMembers(servicerQuery, {});
        let result_Array = servicer.map((item1) => {
            const matchingItem = servicerUser.find(
                (item2) => item2.accountId.toString() === item1._id.toString()
            );

            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: matchingItem.toObject(),
                };
            } else {
                return {};
            }
        });
        let userData = {
            dealerData: dealer ? dealer : {},
            customerData: customer ? customer : {},
            resellerData: reseller ? reseller : {},
            username: singleDealerUser ? singleDealerUser : {},
            resellerUsername: singleResellerUser ? singleResellerUser : {},
            customerUserData: singleCustomerUser ? singleCustomerUser : {},
            servicerData: checkServicer ? checkServicer : {},
        };

        // unique code here

        function makeUnique(array, key) {
            return array.reduce((uniqueArray, currentItem) => {
                const existingItem = uniqueArray.find(item => item[key] === currentItem[key]);
                if (!existingItem) {
                    uniqueArray.push(currentItem);
                }
                return uniqueArray;
            }, []);
        }
        result_Array = makeUnique(result_Array, '_id');
        res.send({
            code: constant.successCode,
            message: "Success!",
            result: checkOrder,
            orderUserData: userData,
            servicers: result_Array
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//get edit order Detail
exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        let logData = {
            endpoint: "order/editOrderDetail",
            body: data,
            userId: req.userId,
            response: {}
        };
        data.venderOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        let checkId = await orderService.getOrder({ _id: req.params.orderId });
        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid order ID",
            });
            return;
        }
        if (checkId.status == "Active" || checkId.status == "Archieved") {
            res.send({
                code: constant.errorCode,
                message: "Order is already active",
            });
            return;
        }
        if (data.dealerId != "") {
            if (data.dealerId.toString() != checkId.dealerId.toString()) {
                let checkDealer = await dealerService.getDealerById(
                    data.dealerId
                );
                if (!checkDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Dealer not found",
                    });
                    return;
                }
            }
        }

        if (data.servicerId != "") {
            if (data.servicerId != '' && data.servicerId != checkId.servicerId) {
                let query = {
                    $or: [
                        { _id: data.servicerId },
                        { resellerId: data.servicerId },
                        { dealerId: data.servicerId },
                    ],
                };
                let checkServicer = await servicerService.getServiceProviderById(query);
                if (!checkServicer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Servicer not found",
                    });
                    return;
                }
            }
        }
        if (data.customerId != "") {
            if (data.customerId != '' && data.customerId != checkId.customerId) {
                let query = { _id: data.customerId };
                let checkCustomer = await customerService.getCustomerById(query);
                if (!checkCustomer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Customer not found",
                    });
                    return;
                }
            }
        }

        if (checkId.status == 'Archieved') {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived!",
            });
            return;
        }
        if (data.billTo == "Dealer") {
            let checkDealer1 = await dealerService.getDealerById(
                data.dealerId
            );
            let getUser = await userService.getSingleUserByEmail({ accountId: checkDealer1._id, isPrimary: true })
            data.billDetail = {
                billTo: "Dealer",
                detail: {
                    name: checkDealer1.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: checkDealer1.street + ' , ' + checkDealer1.city + ' , ' + checkDealer1.country + ' , ' + checkDealer1.zip
                }
            }
        }
        if (data.billTo == "Reseller") {
            let getReseller = await resellerService.getReseller({ _id: data.resellerId })
            let getUser = await userService.getSingleUserByEmail({ accountId: getReseller._id, isPrimary: true })
            data.billDetail = {
                billTo: "Reseller",
                detail: {
                    name: getReseller.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: getReseller.street + ' , ' + getReseller.city + ' , ' + getReseller.country + ' , ' + getReseller.zip
                }
            }
        }
        if (data.billTo == "Custom") {
            data.billDetail = {
                billTo: "Custom",
                detail: {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address
                }
            }
        }
        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;
        let serviceCoverage = '';
        if (req.body.serviceCoverageType == "Labour") {
            serviceCoverage = "Labor"
        }
        if (req.body.serviceCoverageType == "Parts & Labour") {
            serviceCoverage = "Parts & Labor"
        }

        data.serviceCoverageType = serviceCoverage != '' ? serviceCoverage : req.body.serviceCoverageType

        if (data.paymentStatus == "Paid") {
            data.paidAmount = data.orderAmount
            data.dueAmount = 0
        }

        if (data.paidAmount == data.orderAmount) {
            data.paymentStatus = "Paid"
        }
        if (req.files) {
            const uploadedFiles = req.files.map((file) => ({
                fileName: file.filename,
                originalName: file.originalname,
                filePath: file.path,
            }));

            const filteredProducts = data.productsArray.filter(
                (product) => product.orderFile.fileName !== ""
            );
            const filteredProducts2 = data.productsArray.filter(
                (product) => product.file === ""
            );

            const productsWithOrderFiles = filteredProducts.map((product, index) => {
                const file = uploadedFiles[index];
                // Check if 'file' is not null
                if (file && file.filePath) {
                    return {
                        ...product,
                        file: file.filePath,
                        orderFile: {
                            fileName: file.fileName,
                            originalName: file.originalName,
                        },
                    };
                } else {
                    // If 'file' is null, return the original product without modifications
                    return product;
                }
            });

            const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
            data.productsArray = finalOutput;
        }

        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            data,
            { new: true }
        );
        if (!savedResponse) {
            logData.response = {
                code: constant.errorCode,
                message: "unable to update order",
            };
            await LOG(logData).save();
            res.send({
                code: constant.errorCode,
                message: "unable to update order",
            });
            return;
        }

        // check to processed order 
        let returnField = [];

        let checkOrder = await orderService.getOrder(
            { _id: req.params.orderId },
            // { isDeleted: 0 }
        );
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: "Order not found!",
            });
            return;
        }

        let resultArray = checkOrder.productsArray.map(
            (item) => item.coverageStartDate === null
        );
        let isEmptyOrderFile = checkOrder.productsArray
            .map(
                (item) =>
                    item.orderFile.fileName === ""
            )
        // .some(Boolean);
        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);
        //send notification to dealer,reseller,admin,customer
        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
        IDs.push(dealerPrimary._id)
        let notificationData = {
            title: "Order update",
            description: "The order " + savedResponse.unique_key + " has been updated",
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'order',
            redirectionId: savedResponse.unique_key,
            notificationFor: IDs
        };
        let createNotification = await userService.createNotification(notificationData);

        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        //Email to Dealer
        let emailData = {
            senderName: dealerPrimary.firstName,
            content: "The  order " + savedResponse.unique_key + " has been updated",
            subject: "Order Update"
        }

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))

        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let savedResponse = await orderService.updateOrder(
                { _id: req.params.orderId },
                { status: "Active" },
                { new: true }
            );
            let checkDealer1 = await dealerService.getDealerById(
                savedResponse.dealerId
            );

            let paidDate = {
                name: "processOrder",
                date: new Date()
            }
            let updatePaidDate = await orderService.updateOrder(
                { _id: req.params.orderId },
                { paidDate: paidDate },
                { new: true }
            );
            var pricebookDetail = []
            let count1 = await contractService.getContractsCountNew();
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let checkLength = savedResponse.productsArray.length - 1
            let save = savedResponse.productsArray.map(async (product, index) => {
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                const readOpts = { // <--- need these settings in readFile options
                    cellDates: true
                };
                const jsonOpts = {
                    defval: '',
                    raw: false,
                    dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
                }
                let priceBookId = product.priceBookId;
                let orderProductId = product._id;
                let coverageStartDate = product.coverageStartDate;
                let coverageEndDate = product.coverageEndDate;
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                let projection = { isDeleted: 0 };
                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                // reporting codes
                let pricebookDetailObject = {}
                let dealerBookDetail = []
                let dealerPriceBookObject = {}

                pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
                pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
                pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
                pricebookDetailObject._id = product?.priceBookDetails._id
                pricebookDetailObject.name = product?.priceBookDetails.name
                pricebookDetailObject.categoryId = product?.priceBookDetails.category
                pricebookDetailObject.term = product?.priceBookDetails.term
                pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
                pricebookDetailObject.price = product.price
                pricebookDetailObject.noOfProducts = product.checkNumberProducts

                pricebookDetailObject.retailPrice = product.unitPrice
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails.brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails._id
                pricebookDetail.push(pricebookDetailObject)
                dealerBookDetail.push(dealerPriceBookObject)
                const wb = XLSX.readFile(pathFile, readOpts);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
                const totalDataComing1 = XLSX.utils.sheet_to_json(ws, jsonOpts);
                const totalDataComing = totalDataComing1.map((item) => {
                    const keys = Object.keys(item);
                    return {
                        brand: item[keys[0]],
                        model: item[keys[1]],
                        serial: item[keys[2]],
                        condition: item[keys[3]],
                        retailValue: item[keys[4]],
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                var contractArray = [];

                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: priceBookId })
                totalDataComing.forEach((data, index) => {
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + "2024" + unique_key_number1
                    let unique_key1 = "OC-" + "2024-" + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                    claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                    // -------------------------------------------------  copy from -----------------------------------------//

                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh != '' ? product.adh : 0 : 0)
                    let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                    let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                    dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + adhDays))
                    let p_date = new Date(data.purchaseDate)
                    let p_date1 = new Date(data.purchaseDate)
                    let l_date = new Date(data.purchaseDate)
                    let l_date1 = new Date(data.purchaseDate)
                    let purchaseMonth = p_date.getMonth();
                    let monthsPart = partWarrantyMonth;
                    let newPartMonth = purchaseMonth + monthsPart;

                    let monthsLabour = labourWarrantyMonth;
                    let newLabourMonth = purchaseMonth + monthsLabour;

                    let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
                    let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
                    let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
                    let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
                    //---------------------------------------- till here ----------------------------------------------
                    function findMinDate(d1, d2, d3) {
                        return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));
                    }

                    // Find the minimum date
                    let minDate;

                    if (checkOrder.coverageType == "Breakdown") {
                        if (checkOrder.serviceCoverageType == "Labour") {
                            minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                        } else if (checkOrder.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        } else {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    } else if (checkOrder.coverageType == "Accidental") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                    } else {
                        if (checkOrder.serviceCoverageType == "Labour") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                        } else if (checkOrder.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        } else {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    }

                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    let serviceCoverage;
                    if (checkOrder.serviceCoverageType == "Labour") {
                        serviceCoverage = "Labor"
                    }
                    if (checkOrder.serviceCoverageType == "Parts & Labour") {
                        serviceCoverage = "Parts & Labor"
                    }

                    let contractObject = {
                        orderId: savedResponse._id,
                        orderUniqueKey: savedResponse.unique_key,
                        venderOrder: savedResponse.venderOrder,
                        orderProductId: orderProductId,
                        minDate: minDate,
                        coverageStartDate: coverageStartDate,
                        coverageEndDate: coverageEndDate,
                        serviceCoverageType: serviceCoverage,
                        coverageType: checkOrder.coverageType,
                        productName: priceBook[0]?.name,
                        pName: priceBook[0]?.pName,
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: new Date(partsWarrantyDate1),
                        labourWarranty: new Date(labourWarrantyDate1),
                        purchaseDate: new Date(data.purchaseDate),
                        status: claimStatus,
                        eligibilty: eligibilty,
                        serial: data.serial,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };
                    increamentNumber++;
                    contractArray.push(contractObject);
                });
                let saveData = await contractService.createBulkContracts(contractArray)
                if (saveData.length == 0) {
                    logData.response = {
                        code: constant.errorCode,
                        message: "unable to make contracts",
                        result: saveData
                    };
                    await LOG(logData).save();
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Pending" },
                        { new: true }
                    );
                } else {
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Active" },
                        { new: true }
                    );

                    // 
                    //Send email to customer with term and condtion
                    //generate T anc C
                    if (checkDealer1?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }
                    // send notification to dealer,admin, customer
                    let IDs = await supportingFunction.getUserIds()
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
                    let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
                    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.resellerId, isPrimary: true })
                    if (resellerPrimary) {
                        IDs.push(resellerPrimary._id)
                    }
                    IDs.push(dealerPrimary._id, customerPrimary._id)
                    let notificationData1 = {
                        title: "Process Order",
                        description: "The order " + checkOrder.unique_key + " has been updated and processed",
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: checkOrder.unique_key,
                        notificationFor: IDs
                    };
                    let createNotification = await userService.createNotification(notificationData1);
                    // Send Email code here
                    let notificationEmails = await supportingFunction.getUserEmails();
                    //Email to Dealer
                    let emailData = {
                        senderName: dealerPrimary.firstName,
                        content: "The  order " + savedResponse.unique_key + " updated and processed",
                        subject: "Process Order"
                    }

                    let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
                    //Email to Reseller
                    emailData = {
                        senderName: resellerPrimary?.firstName,
                        content: "The  order " + savedResponse.unique_key + " has been paid",
                        subject: "Process Order"
                    }

                    mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
                    //Email to customer code here........
                    if (index == checkLength) {

                        let reportingData = {
                            orderId: savedResponse._id,
                            products: pricebookDetail,
                            orderAmount: data.orderAmount,
                            dealerId: data.dealerId,
                            // dealerPriceBook: dealerBookDetail
                        }

                        await supportingFunction.reportingData(reportingData)
                    }

                }


            })

            // reporting codes
            logData.response = {
                code: constant.successCode,
                message: "Success",
            };
            await LOG(logData).save();
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        } else {
            logData.response = {
                code: constant.successCode,
                message: "Success",
            };
            await LOG(logData).save();
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        }

    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "order/editOrderDetail catch",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

// Mark as paid
exports.markAsPaid = async (req, res) => {
    try {
        let data = req.body
        let logData = {
            endpoint: "order/markAsPaid",
            body: data,
            userId: req.userId,
            response: {}
        };
        const checkOrder = await orderService.getOrder({ _id: req.params.orderId }, { isDeleted: false })
        if (checkOrder.status == 'Archieved') {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived!",
            });
            return;
        }
        const checkDealer = await dealerService.getDealerById(
            checkOrder.dealerId
        );
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found",
            });
            return;
        }
        let updateOrder = await orderService.updateOrder({ _id: req.params.orderId }, { paymentStatus: "Paid", status: "Active", dueAmount: 0, paidAmount: checkOrder.orderAmount }, { new: true })
        if (!updateOrder) {
            logData.response = {
                code: constant.errorCode,
                message: "unable to update the payment status"
            };
            await LOG(logData).save();
            res.send({
                code: constant.errorCode,
                message: "unable to udpate the paytment status"
            })
            return;
        }

        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            { status: "Active" },
            { new: true }
        );
        let count1 = await contractService.getContractsCountNew();
        var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
        let checkLength = savedResponse.productsArray.length - 1
        let save = savedResponse.productsArray.map(async (product, index) => {
            const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
            const readOpts = {
                // <--- need these settings in readFile options //cellText:false, 
                cellDates: true
            };
            const jsonOpts = {
                //header: 1,
                defval: '',
                // blankrows: true,
                raw: false,
                dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
            }
            let priceBookId = product.priceBookId;
            let orderProductId = product._id;
            let coverageStartDate = product.coverageStartDate;
            let coverageEndDate = product.coverageEndDate;
            let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
            let projection = { isDeleted: 0 };
            let priceBook = await priceBookService.getPriceBookById(
                query,
                projection
            );
            var pricebookDetail = []
            // reporting codes
            let dealerBookDetail = []
            let pricebookDetailObject = {}
            let dealerPriceBookObject = {}

            pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
            pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
            pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
            pricebookDetailObject._id = product?.priceBookDetails._id
            pricebookDetailObject.name = product?.priceBookDetails.name
            pricebookDetailObject.categoryId = product?.priceBookDetails.category
            pricebookDetailObject.term = product?.priceBookDetails.term
            pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
            pricebookDetailObject.price = product.price
            pricebookDetailObject.noOfProducts = product.checkNumberProducts

            pricebookDetailObject.retailPrice = product.unitPrice
            pricebookDetailObject.brokerFee = product.dealerPriceBookDetails.brokerFee
            pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails._id
            pricebookDetail.push(pricebookDetailObject)
            dealerBookDetail.push(dealerPriceBookObject)
            const wb = XLSX.readFile(pathFile, readOpts);
            const sheets = wb.SheetNames;
            const ws = wb.Sheets[sheets[0]];

            const totalDataComing1 = XLSX.utils.sheet_to_json(ws, jsonOpts);
            const totalDataComing = totalDataComing1.map((item) => {
                const keys = Object.keys(item);
                return {
                    brand: item[keys[0]],
                    model: item[keys[1]],
                    serial: item[keys[2]],
                    condition: item[keys[3]],
                    retailValue: item[keys[4]],
                    partsWarranty: item[keys[5]],
                    labourWarranty: item[keys[6]],
                    purchaseDate: item[keys[7]],
                };
            });
            var contractArray = [];

            let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: priceBookId })

            totalDataComing.forEach((data, index) => {
                let unique_key_number1 = increamentNumber
                let unique_key_search1 = "OC" + "2024" + unique_key_number1
                let unique_key1 = "OC-" + "2024-" + unique_key_number1
                let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                // ----------------------------------------------------------------      copy from    ---------------------------------------------------//

                let dateCheck = new Date(product.coverageStartDate)
                let adhDays = Number(product.adh ? product.adh != '' ? product.adh : 0 : 0)
                let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + adhDays))
                let p_date = new Date(data.purchaseDate)
                let p_date1 = new Date(data.purchaseDate)
                let l_date = new Date(data.purchaseDate)
                let l_date1 = new Date(data.purchaseDate)
                let purchaseMonth = p_date.getMonth();
                let monthsPart = partWarrantyMonth;
                let newPartMonth = purchaseMonth + monthsPart;

                let monthsLabour = labourWarrantyMonth;
                let newLabourMonth = purchaseMonth + monthsLabour;

                let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
                let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
                let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
                let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
                //---------------------------------------- till here ----------------------------------------------
                function findMinDate(d1, d2, d3) {
                    return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));
                }

                // Find the minimum date
                let minDate;

                if (checkOrder.coverageType == "Breakdown") {
                    if (checkOrder.serviceCoverageType == "Labour") {
                        minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                    } else if (checkOrder.serviceCoverageType == "Parts") {
                        minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                    } else {
                        minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                    }
                } else if (checkOrder.coverageType == "Accidental") {
                    minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                } else {
                    if (checkOrder.serviceCoverageType == "Labour") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                    } else if (checkOrder.serviceCoverageType == "Parts") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                    } else {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                    }
                }

                let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                let serviceCoverage;
                if (checkOrder.serviceCoverageType == "Labour") {
                    serviceCoverage = "Labor"
                }
                if (checkOrder.serviceCoverageType == "Parts & Labour") {
                    serviceCoverage = "Parts & Labor"
                }

                let contractObject = {
                    orderId: savedResponse._id,
                    orderUniqueKey: savedResponse.unique_key,
                    venderOrder: savedResponse.venderOrder,
                    orderProductId: orderProductId,
                    minDate: minDate,
                    coverageStartDate: coverageStartDate,
                    coverageEndDate: coverageEndDate,
                    serviceCoverageType: serviceCoverage,
                    coverageType: checkOrder.coverageType,
                    productName: priceBook[0]?.name,
                    pName: priceBook[0]?.pName,
                    manufacture: data.brand,
                    model: data.model,
                    partsWarranty: new Date(partsWarrantyDate1),
                    labourWarranty: new Date(labourWarrantyDate1),
                    purchaseDate: new Date(data.purchaseDate),
                    status: claimStatus,
                    eligibilty: eligibilty,
                    serial: data.serial,
                    condition: data.condition,
                    productValue: data.retailValue,
                    unique_key: unique_key1,
                    unique_key_search: unique_key_search1,
                    unique_key_number: unique_key_number1,
                };
                increamentNumber++;
                contractArray.push(contractObject);
            });
            let saveData = await contractService.createBulkContracts(contractArray)
            if (saveData.length == 0) {
                logData.response = {
                    code: constant.errorCode,
                    message: "unable to make contracts",
                    result: saveData
                };
                await LOG(logData).save();
                let savedResponse = await orderService.updateOrder(
                    { _id: checkOrder._id },
                    { status: "Pending" },
                    { new: true }
                );
            } else {
                let savedResponse = await orderService.updateOrder(
                    { _id: checkOrder._id },
                    { status: "Active" },
                    { new: true }
                );


                //Send email to customer with term and condtion
                //generate T anc C
                if (checkDealer?.termCondition) {
                    const tcResponse = await generateTC(savedResponse);
                }
                // send notification to dealer,admin, customer
                let IDs = await supportingFunction.getUserIds()
                let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
                let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
                let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.resellerId, isPrimary: true })
                if (resellerPrimary) {
                    IDs.push(resellerPrimary._id)
                }
                IDs.push(dealerPrimary._id, customerPrimary._id)
                let notificationData1 = {
                    title: "Mark As Paid",
                    description: "The order " + checkOrder.unique_key + " has been mark as paid",
                    userId: req.teammateId,
                    contentId: checkOrder._id,
                    flag: 'order',
                    redirectionId: checkOrder.unique_key,
                    notificationFor: IDs
                };
                let createNotification = await userService.createNotification(notificationData1);
                // Send Email code here
                let notificationEmails = await supportingFunction.getUserEmails();
                //Email to Dealer
                let emailData = {
                    senderName: dealerPrimary.firstName,
                    content: "The  order " + savedResponse.unique_key + " has been paid",
                    subject: "Mark as paid"
                }

                let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
                //Email to Reseller 
                emailData = {
                    senderName: resellerPrimary?.firstName,
                    content: "The  order " + savedResponse.unique_key + " has been paid",
                    subject: "Mark As paid"
                }

                mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
                //Email to customer code here........
                if (index == checkLength) {

                    let reportingData = {
                        orderId: savedResponse._id,
                        products: pricebookDetail,
                        orderAmount: checkOrder.orderAmount,
                        dealerId: checkOrder.dealerId,
                    }
                    await supportingFunction.reportingData(reportingData)
                }
            }
        })

        let paidDate = {
            name: "markAsPaid",
            date: new Date()
        }
        let updatePaidDate = await orderService.updateOrder(
            { _id: req.params.orderId },
            { paidDate: paidDate },
            { new: true }
        );

        logData.response = {
            code: constant.successCode,
            message: "Updated Successfully"
        };
        await LOG(logData).save();
        res.send({
            code: constant.successCode,
            message: "Updated Successfully"
        })
    } catch (err) {
        let logData = {
            endpoint: "order/markAsPaid catch",
            body: req.body,
            userId: req.userId,
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
};

//Get dashbaord value for order and claims
exports.getDashboardData = async (req, res) => {
    try {
        let data = req.body;
        let project = {
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            unique_key_number: 1,
            unique_key_search: 1,
            servicerId: 1,
            customerId: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            venderOrder: 1,
            orderAmount: 1,
        };

        let query = { status: 'Active' };
        var checkOrders_ = await orderService.getDashboardData(query, project)
        let claimQuery = [
            {
                $match: { claimFile: 'Completed' }
            },
            {
                "$group": {
                    "_id": "",
                    "totalAmount": {
                        "$sum": {
                            "$sum": "$totalAmount"
                        }
                    },
                },

            },
        ]

        let valueClaim = await claimService.getClaimWithAggregate(claimQuery);
        let numberOfClaims = await claimService.getClaims({ claimFile: 'Completed' });
        if (!checkOrders_[0] && numberOfClaims.length == 0 && valueClaim[0]?.totalAmount == 0) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch order data",
                result: {
                    claimData: claimData,
                    orderData: {
                        "_id": "",
                        "totalAmount": 0,
                        "totalOrder": 0
                    }
                }
            })
            return;
        }
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim[0]?.totalAmount
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: {
                claimData: claimData,
                orderData: checkOrders_[0]
            }
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get Order Contract
exports.getOrderContract = async (req, res) => {
    try {
        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let dealerIds = [];
        let customerIds = [];
        let resellerIds = [];
        let servicerIds = [];
        let userSearchCheck = 0
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
            let getData = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                servicerIds = await getData.map(servicer => servicer._id)
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
        if (data.dealerName != "") {
            userSearchCheck = 1
            let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                dealerIds = await getData.map(dealer => dealer._id)
            } else {
                dealerIds.push("1111121ccf9d400000000000")
            }
        };
        let orderAndCondition = []
        if (req.params.orderId) {
            userSearchCheck = 1
            orderAndCondition.push({ _id: new mongoose.Types.ObjectId(req.params.orderId) })
        };

        if (dealerIds.length > 0) {
            orderAndCondition.push({ dealerId: { $in: dealerIds } })
        }
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })
        }
        let orderIds = []
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
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { eligibilty: data.eligibilty === "true" ? true : false },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        } else {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        let mainQuery = []
        if (data.contractId === "" && data.productName === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
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
                            },
                            {
                                $project: {
                                    productName: 1,
                                    model: 1,
                                    serial: 1,
                                    unique_key: 1,
                                    status: 1,
                                    minDate: 1,
                                    productValue: 1,
                                    manufacture: 1,
                                    eligibilty: 1,
                                    orderUniqueKey: 1,
                                    venderOrder: 1,
                                    totalRecords: 1
                                }
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
                        {
                            $project: {
                                productName: 1,
                                model: 1,
                                serial: 1,
                                unique_key: 1,
                                status: 1,
                                minDate: 1,
                                manufacture: 1,
                                serviceCoverageType: 1,
                                productValue: 1,
                                coverageType: 1,
                                eligibilty: 1,
                                orderUniqueKey: 1,
                                venderOrder: 1,
                                totalRecords: 1
                            }
                        }
                    ],
                },

            })
        }
        let getContracts = await contractService.getAllContracts2(mainQuery)
        checkOrder = getContracts[0]?.data ? getContracts[0]?.data : []
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

        let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
        for (let e = 0; e < result1.length; e++) {
            result1[e].reason = " "
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
                                    if: { $eq: ["$claimFile", "Open"] }, // Assuming "claimFile" field is correct
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
        }
        if (!checkOrder[0]) {
            res.send({
                code: constant.successCode,
                message: "Success!",
                result: result1,
                totalCount: 0,
                orderUserData: {}
            })
            return
        }

        res.send({
            code: constant.successCode,
            message: "Success!",
            result: getContracts[0]?.data ? getContracts[0]?.data : [],
            totalCount: totalCount,
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getOrderPdf = async (req, res) => {
    try {
        let data = req.body
        let query = [
            {
                $match: { orderId: new mongoose.Types.ObjectId(req.params.orderId) }
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "orderId",
                    foreignField: "_id",
                    as: "order"
                }
            },
        ]
        let checkOrder = await contractService.getContractForPDF(query)
        if (!checkOrder[0]) {
            res.send({
                code: constant.successCode,
                message: "Success!",
                result: checkOrder,
                contractCount: 0,
                orderUserData: {}
            })
            return
        }

        // checkOrder = checkOrder;
        let arrayToPromise = checkOrder[0] ? checkOrder[0].order[0].productsArray : []
        checkOrder.productsArray = await Promise.all(arrayToPromise.map(async (product) => {
            const pricebook = await priceBookService.findByName1({ _id: product.priceBookId });
            const pricebookCat = await priceBookService.getPriceCatByName({ _id: product.categoryId });
            if (pricebook) {
                product.name = pricebook.name;
            }
            if (pricebookCat) {
                product.catName = pricebookCat.name;
            }

            return product;
        }));


        // return
        //Get Dealer Data
        let dealer = await dealerService.getDealerById(checkOrder[0].order[0] ? checkOrder[0].order[0].dealerId : '', { isDeleted: 0 });
        //Get customer Data
        let customer = await customerService.getCustomerById({ _id: checkOrder[0].order[0] ? checkOrder[0].order[0].customerId : '' }, { isDeleted: 0 });
        //Get Reseller Data

        let reseller = await resellerService.getReseller({ _id: checkOrder[0].order[0].resellerId }, { isDeleted: 0 })

        const queryDealerUser = { accountId: { $in: [checkOrder[0].order[0].dealerId != null ? checkOrder[0].order[0].dealerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

        const queryResselerUser = { accountId: { $in: [checkOrder[0].order[0].resellerId != null ? checkOrder[0].order[0].resellerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

        let dealerUser = await userService.findUserforCustomer(queryDealerUser)

        let resellerUser = await userService.findUserforCustomer(queryResselerUser)

        //Get Servicer Data

        let query1 = {
            $or: [
                { _id: checkOrder[0].order[0].servicerId ? checkOrder[0].order[0].servicerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
            ],
        };

        let checkServicer = await servicerService.getServiceProviderById(query1);

        let userData = {
            dealerData: dealer ? dealer : {},
            customerData: customer ? customer : {},
            resellerData: reseller ? reseller : {},
            servicerData: checkServicer ? checkServicer : {},
            username: dealerUser ? dealerUser[0] : {}, // Set username based on the conditional checks
            resellerUsername: resellerUser ? resellerUser[0] : {}
        };


        res.send({
            code: constant.successCode,
            message: "Success!",
            result: checkOrder,
            orderUserData: userData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Generate T and C
async function generateTC(orderData) {
    try {
        let response;
        let link;
        const checkOrder = await orderService.getOrder({ _id: orderData._id }, { isDeleted: false })
        let coverageStartDate = checkOrder.productsArray[0]?.coverageStartDate;
        let coverageEndDate = checkOrder.productsArray[0]?.coverageEndDate;
        //Get Dealer
        const checkDealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: false })
        //Get customer
        const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: false })
        //Get customer primary info
        const customerUser = await userService.getUserById1({ metaId: checkOrder.customerId, isPrimary: true }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            if (!item.exit) return contractService.getContractById({
                orderProductId: item._id
            });
            else {
                return null;
            }
        })
        const contractArray = await Promise.all(contractArrayPromise);

        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: quanitityProduct.name,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract.productName,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaId: checkOrder.servicerId, isPrimary: true }, { isDeleted: false })
        //res.json(checkDealer);return
        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm',
            childProcessOptions: {
                env: {
                    OPENSSL_CONF: '/dev/null',
                },
            }
        }
        let mergeFileName = checkOrder.unique_key + '.pdf'
        const orderFile = 'pdfs/' + mergeFileName;
        const html = `<head>
        <link rel="stylesheet" href="https://gistcdn.githack.com/mfd/09b70eb47474836f25a21660282ce0fd/raw/e06a670afcb2b861ed2ac4a1ef752d062ef6b46b/Gilroy.css"></link>
        </head>
        <table border='1' border-collapse='collapse' style=" border-collapse: collapse; font-size:13px;font-family:  'Gilroy', sans-serif;">
                            <tr>
                                <td style="width:50%; font-size:13px;padding:15px;">  GET COVER service contract number:</td>
                                <td style="font-size:13px;">${checkOrder.unique_key}</td>
                            </tr>
                            <tr>
                                <td style="font-size:13px;padding:15px;">${checkReseller ? "Reseller Name" : "Dealer Name"}:</td>
                                <td style="font-size:13px;"> 
                                    <p><b>Attention –</b> ${checkReseller ? checkReseller.name : checkDealer.name}</p>
                                    <p> <b>Email Address – </b>${resellerUser ? resellerUser?.email : DealerUser.email}</p>
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''}, ${checkCustomer ? checkCustomer?.city : ''}, ${checkCustomer ? checkCustomer?.state : ''}, ${checkCustomer ? checkCustomer?.country : ''}</td>
                   </tr>
                <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${checkOrder.productsArray[0]?.term / 12} 
                ${checkOrder.productsArray[0]?.term / 12 === 1 ? 'Year' : 'Years'}
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${moment(coverageEndDate).format("MM/DD/YYYY")}</td>
          </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">Number of covered components:</td>
               <td> ${tableRows}   </td>                 
            </tr >
            
        </table > `;

        pdf.create(html, options).toFile(orderFile, async (err, result) => {
            if (err) return console.log(err);
            // -------------------merging pdfs 
            const { PDFDocument, rgb } = require('pdf-lib');
            const fs = require('fs').promises;

            async function mergePDFs(pdfPath1, pdfPath2, outputPath) {
                // Load the PDFs
                const pdfDoc1Bytes = await fs.readFile(pdfPath1);
                const pdfDoc2Bytes = await fs.readFile(pdfPath2);

                const pdfDoc1 = await PDFDocument.load(pdfDoc1Bytes);
                const pdfDoc2 = await PDFDocument.load(pdfDoc2Bytes);

                // Create a new PDF Document
                const mergedPdf = await PDFDocument.create();

                // Add the pages of the first PDF
                const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                // Add the pages of the second PDF
                const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                // Serialize the PDF
                const mergedPdfBytes = await mergedPdf.save();

                // Write the merged PDF to a file
                await fs.writeFile(outputPath, mergedPdfBytes);
            }

            const termConditionFile = checkOrder.termCondition.fileName ? checkOrder.termCondition.fileName : checkOrder.termCondition.filename
            // Usage
            const pdfPath2 = process.env.MAIN_FILE_PATH + orderFile;
            const pdfPath1 = process.env.MAIN_FILE_PATH + "uploads/" + termConditionFile;
            const outputPath = process.env.MAIN_FILE_PATH + "uploads/" + "mergedFile/" + mergeFileName;
            link = `${process.env.SITE_URL}:3002/uploads/" + "mergedFile/` + mergeFileName;
            let pathTosave = await mergePDFs(pdfPath1, pdfPath2, outputPath).catch(console.error);
            const pathToAttachment = process.env.MAIN_FILE_PATH + "/uploads/mergedFile/" + mergeFileName
            fs.readFile(pathToAttachment)
                .then(async (fileData) => {
                    const attachment = fileData.toString('base64');
                    try {
                        //sendTermAndCondition
                        // Send Email code here
                        let notificationEmails = await supportingFunction.getUserEmails();
                        notificationEmails.push(DealerUser.email)
                        notificationEmails.push(resellerUser?.email)
                        let emailData = {
                            senderName: customerUser.firstName,
                            content: "Please read the following terms and conditions for your order. If you have any questions, feel free to reach out to our support team.",
                            subject: 'Order Term and Condition-' + checkOrder.unique_key,
                        }
                        let mailing = await sgMail.send(emailConstant.sendTermAndCondition(customerUser.email, notificationEmails, emailData, attachment))

                    } catch (error) {
                        console.error('Error sending email:', error);
                        if (error.response) {
                            console.error('Error response:', error.response.body);
                        }
                    }
                })
                .catch(err => {
                    console.error("Error reading the file:", err);
                });


        })
        return 1

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
}

//Generate HTML to PDF
exports.generateHtmltopdf = async (req, res) => {
    try {
        let response;
        let link;
        const checkOrder = await orderService.getOrder({ _id: req.params.orderId }, { isDeleted: false })
        let coverageStartDate = checkOrder.productsArray[0]?.coverageStartDate;
        let coverageEndDate = checkOrder.productsArray[0]?.coverageEndDate;
        //Get Dealer
        const checkDealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: false })
        //Get customer
        const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: false })
        //Get customer primary info
        const customerUser = await userService.getUserById1({ metaId: checkOrder.customerId, isPrimary: true }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            if (!item.exit) return contractService.getContractById({
                orderProductId: item._id
            });
            else {
                return null;
            }
        })
        const contractArray = await Promise.all(contractArrayPromise);
        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: quanitityProduct.name,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract.productName,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        // res.json(productCoveredArray);
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaId: checkOrder.servicerId, isPrimary: true }, { isDeleted: false })
        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm',
            childProcessOptions: {
                env: {
                    OPENSSL_CONF: '/dev/null',
                },
            }
        }
        let mergeFileName = checkOrder.unique_key + '.pdf'
        const orderFile = 'pdfs/' + mergeFileName;
        const html = `<head>
        <link rel="stylesheet" href="https://gistcdn.githack.com/mfd/09b70eb47474836f25a21660282ce0fd/raw/e06a670afcb2b861ed2ac4a1ef752d062ef6b46b/Gilroy.css"></link>
        </head>
        <table border='1' border-collapse='collapse' style=" border-collapse: collapse; font-size:13px;font-family:  'Gilroy', sans-serif;">
                            <tr>
                                <td style="width:50%; font-size:13px;padding:15px;">  GET COVER service contract number:</td>
                                <td style="font-size:13px;">${checkOrder.unique_key}</td>
                            </tr>
                            <tr>
                                <td style="font-size:13px;padding:15px;">${checkReseller ? "Reseller Name" : "Dealer Name"}:</td>
                                <td style="font-size:13px;"> 
                                    <p><b>Attention –</b> ${checkReseller ? checkReseller.name : checkDealer.name}</p>
                                    <p> <b>Email Address – </b>${resellerUser ? resellerUser?.email : DealerUser.email}</p>
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''},${checkCustomer ? checkCustomer?.city : ''},${checkCustomer ? checkCustomer?.state : ''}</td>
                   </tr>
                <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${checkOrder.productsArray[0]?.term / 12} 
                ${checkOrder.productsArray[0]?.term / 12 === 1 ? 'Year' : 'Years'}
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${moment(coverageEndDate).format("MM/DD/YYYY")}</td>
          </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">Number of covered components:</td>
               <td> ${tableRows}   </td>                 
            </tr >
            
        </table > `;
        if (fs.existsSync(process.env.MAIN_FILE_PATH + "uploads/" + "mergedFile/" + mergeFileName)) {
            link = `${process.env.SITE_URL}:3002/uploads/" + "mergedFile/` + mergeFileName;
            response = { link: link, fileName: mergeFileName }
            res.send({
                code: constant.successCode,
                message: 'Success!',
                result: response
            })
        } else {
            pdf.create(html, options).toFile(orderFile, async (err, result) => {
                if (err) return console.log(err);
                // -------------------merging pdfs 
                const { PDFDocument, rgb } = require('pdf-lib');
                const fs = require('fs').promises;

                async function mergePDFs(pdfPath1, pdfPath2, outputPath) {
                    // Load the PDFs
                    const pdfDoc1Bytes = await fs.readFile(pdfPath1);
                    const pdfDoc2Bytes = await fs.readFile(pdfPath2);

                    const pdfDoc1 = await PDFDocument.load(pdfDoc1Bytes);
                    const pdfDoc2 = await PDFDocument.load(pdfDoc2Bytes);

                    // Create a new PDF Document
                    const mergedPdf = await PDFDocument.create();

                    // Add the pages of the first PDF
                    const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                    pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                    // Add the pages of the second PDF
                    const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                    pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                    // Serialize the PDF
                    const mergedPdfBytes = await mergedPdf.save();

                    // Write the merged PDF to a file
                    await fs.writeFile(outputPath, mergedPdfBytes);
                }

                //  const termConditionFile = checkDealer.termCondition.fileName ? checkDealer.termCondition.fileName : checkDealer.termCondition.filename

                const termConditionFile = checkOrder.termCondition.fileName ? checkOrder.termCondition.fileName : checkOrder.termCondition.filename
                // Usage
                const pdfPath2 = process.env.MAIN_FILE_PATH + orderFile;
                const pdfPath1 = process.env.MAIN_FILE_PATH + "uploads/" + termConditionFile;
                const outputPath = process.env.MAIN_FILE_PATH + "uploads/" + "mergedFile/" + mergeFileName;
                link = `${process.env.SITE_URL}:3002/uploads/" + "mergedFile/` + mergeFileName;
                let pathTosave = await mergePDFs(pdfPath1, pdfPath2, outputPath).catch(console.error);
                response = { link: link, fileName: mergeFileName }
                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: response
                })

            });
        }

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
}

//Get Pending Amount
exports.getPendingAmount = async (req, res) => {
    try {
        if (req.role != 'Super Admin') {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action!"
            })
            return;
        }
        let getOrderDetail = await orderService.getOrder({ _id: req.params.orderId })
        let orderPaidAmount = getOrderDetail.paidAmount
        let orderDueAmount = getOrderDetail.dueAmount
        let orderAmount = getOrderDetail.orderAmount
        const data = req.body
        let currentTotalAmount = Number(noOfProducts) * Number(oneProductAmount)
        if (getOrderDetail.paymentStatus === "Unpaid") {
            if (orderPaidAmount > currentTotalAmount) {
                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: {
                        pendingAmount: 0,
                        status: 'Paid'
                    }
                })
            } else {
                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: {
                        pendingAmount: Number(currentTotalAmount) - Number(orderPaidAmount),
                        status: 'PartlyPaid'
                    }
                })
            }
        }
        else if (getOrderDetail.paymentStatus === "Paid") {
            if (currentTotalAmount > orderPaidAmount) {
                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: {
                        pendingAmount: Number(currentTotalAmount) - Number(orderPaidAmount),
                        status: 'PartlyPaid'
                    }
                })
            }
            else {
                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: {
                        pendingAmount: 0,
                        status: 'Paid'
                    }
                })
            }
        }

        res.send({
            code: constant.successCode,
            message: 'Success!'
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Update servicer by order id
exports.updateServicerByOrder = async (req, res) => {
    try {
        if (req.role != 'Super Admin') {
            res.send({
                code: constant.errorCode,
                message: 'Only super allow to do this action!'
            })
            return;
        }

        let query = { _id: req.params.orderId }
        const projection = { isDeleted: 0 }
        let checkOrder = await orderService.getOrder(query, projection)
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: 'Order not found!'
            });
            return;
        }
        let creteria = { _id: req.params.orderId }
        let update = await orderService.updateOrder(creteria, { servicerId: req.body.servicerId }, { new: true })
        if (update) {
            res.send({
                code: constant.successCode,
                message: 'Updated Successfully!'
            });
            return
        }

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
};

//Cron job for status
exports.cronJobStatus = async (req, res) => {
    try {
        let query = { status: { $ne: "Archieved" } };
        let data = req.body;
        let currentDate = new Date();
        let endOfDay = new Date();
        endOfDay.setDate(endOfDay.getDate() + 1); // Move to the next day
        endOfDay.setHours(0, 0, 0, 0);
        let lookupQuery = [
            {
                $match: query // Your match condition here
            },
            {
                $addFields: {
                    productsArray: {
                        $map: {
                            input: "$productsArray", // Input array
                            as: "product",
                            in: {
                                $mergeObjects: [
                                    "$$product",
                                    {
                                        ExpiredCondition: { $lt: ["$$product.coverageEndDate", endOfDay] },
                                        WaitingCondition: { $gt: ["$$product.coverageStartDate", currentDate] },
                                        ActiveCondition: {
                                            $and: [
                                                { $lte: ["$$product.coverageStartDate", currentDate] }, // Current date is greater than or equal to coverageStartDate
                                                { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $sort: { unique_key: -1 } // Sorting if required
            },
            {
                $project: {
                    productsArray: 1,
                    _id: 0 // Exclude the _id field if necessary
                }
            }
        ];
        let ordersResult = await orderService.getAllOrders1(lookupQuery);

        let bulk = []
        for (let i = 0; i < ordersResult.length; i++) {
            for (let j = 0; j < ordersResult[i].productsArray.length; j++) {
                let status = ''
                let eligibilty;
                let product = ordersResult[i].productsArray[j];
                let orderProductId = product._id
                let claimStatus = new Date(product.coverageStartDate) > new Date() ? "Waiting" : "Active"
                claimStatus = new Date(product.coverageEndDate) < new Date() ? "Expired" : claimStatus
                if (claimStatus == 'Expired') {
                    eligibilty = false;
                    status = 'Expired'
                }
                if (claimStatus == 'Waiting') {
                    eligibilty = false;
                    status = 'Waiting'
                }
                if (claimStatus == 'Active') {
                    status = 'Active'
                    eligibilty = true;
                }
                let updateDoc = {
                    'updateMany': {
                        'filter': { 'orderProductId': orderProductId },
                        update: { $set: { status: status, eligibilty: eligibilty } },
                        'upsert': false
                    }
                }
                bulk.push(updateDoc)
            }
        }
        const result = await contractService.allUpdate(bulk);

        res.send({
            code: constant.successCode,
            //result:bulk
            result
        })

    }
    catch (err) {
        res.send({
            message: err.message
        })
    }
};

exports.cronJobStatusWithDate = async (req, res) => {
    try {
        const startDate = new Date(req.body.startDate)
        const endDate = new Date(req.body.endDate)
        let currentDate = new Date();
        const orderID = req.body.orderId;
        const orderProductId = req.body.orderProductId;
        const newValue = {
            $set: {
                "productsArray.$.coverageStartDate": startDate,
                "productsArray.$.coverageEndDate": endDate,
            }
        };
        let update = await orderService.updateOrder({ _id: orderID, "productsArray._id": orderProductId }, {
            $set: {
                "productsArray.$.coverageStartDate": req.body.startDate,
                "productsArray.$.coverageEndDate": req.body.endDate,
            }
        }, { multi: true })
        let query = { status: { $ne: "Archieved" } };
        let data = req.body;
        let endOfDay = new Date();
        endOfDay.setDate(endOfDay.getDate() + 1); // Move to the next day
        let lookupQuery = [
            {
                $match: query // Your match condition here 
            },
            {
                $addFields: {
                    productsArray: {
                        $map: {
                            input: "$productsArray", // Input array
                            as: "product",
                            in: {
                                $mergeObjects: [
                                    "$$product",
                                    {
                                        ExpiredCondition: { $lt: ["$$product.coverageEndDate", currentDate] },
                                        // ExpiredCondition: { $and: [
                                        //     { $lt: ["$$product.coverageEndDate", endOfDay] }, // Current date is greater than or equal to coverageStartDate
                                        //     { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                        // ] },

                                        WaitingCondition: { $gt: ["$$product.coverageStartDate", currentDate] },
                                        ActiveCondition: {
                                            $and: [
                                                { $lte: ["$$product.coverageStartDate", currentDate] }, // Current date is greater than or equal to coverageStartDate
                                                { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $sort: { unique_key: -1 } // Sorting if required
            },
            {
                $project: {
                    productsArray: 1,
                    _id: 0 // Exclude the _id field if necessary
                }
            }
        ];
        let ordersResult = await orderService.getAllOrders1(lookupQuery);

        let bulk = []
        for (let i = 0; i < ordersResult.length; i++) {
            for (let j = 0; j < ordersResult[i].productsArray.length; j++) {
                let status = ''
                let eligibilty;
                let product = ordersResult[i].productsArray[j];
                let orderProductId = product._id

                if (product.ExpiredCondition) {
                    eligibilty = false;
                    status = 'Expired'
                }
                if (product.WaitingCondition) {
                    eligibilty = false;
                    status = 'Waiting'
                }
                if (product.ActiveCondition) {
                    status = 'Active'
                    eligibilty = true;
                }
                let updateDoc = {
                    'updateMany': {
                        'filter': { 'orderProductId': orderProductId },
                        update: { $set: { status: status, eligibilty: eligibilty } },
                        'upsert': false
                    }
                }
                bulk.push(updateDoc)
            }
        }
        res.send({
            code: constant.successCode,
            //result:bulk
            bulk
        })
        return;
    }
    catch (err) {
        res.send({
            message: err.message
        })
    }
};

exports.getResellerByDealerAndCustomer = async (req, res) => {
    try {
        let data = req.body
        let getCustomer = await customerService.getCustomerByName({ _id: data.customerId })
        let getReseller = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaId: new mongoose.Types.ObjectId(getCustomer.resellerId) },
                        { isPrimary: true }
                    ]
                }
            },
            {
                $lookup: {
                    from: "resellers",
                    localField: "metaId",
                    foreignField: "_id",
                    as: "resellerData"
                }
            }
        ])
        if (!getReseller) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the detail"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Successfully fetched the detail",
                result: getReseller
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.reportingDataCreation = async (req, res) => {
    try {
        let getAllOrders = await orderService.getAllOrders1([
            {
                $match: { "status": "Active" }
            }
        ])
        if (!getAllOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the orders"
            })
        }

        let reportingToSave = []

        for (let i = 0; i < getAllOrders.length; i++) {
            let orderData = getAllOrders[i]


            let checkOrderId = await supportingFunction.checkReportinWithId({ orderId: orderData._id })
            if (!checkOrderId) {
                let reportingData = {}
                let products = []
                reportingData.orderId = orderData._id
                reportingData.orderAmount = orderData.orderAmount
                reportingData.dealerId = orderData.dealerId
                reportingData.createdAt = orderData.updatedAt
                reportingData.updatedAt = orderData.updatedAt

                for (let p = 0; p < orderData.productsArray.length; p++) {
                    productData = orderData.productsArray[p]
                    let productObject = {}
                    productObject.price = productData.price
                    productObject.noOfProducts = productData.checkNumberProducts
                    productObject.retailPrice = productData.dealerPriceBookDetails.retailPrice
                    productObject.frontingFee = productData.priceBookDetails.frontingFee
                    productObject.reserveFutureFee = productData.priceBookDetails.reserveFutureFee
                    productObject.reinsuranceFee = productData.priceBookDetails.reinsuranceFee
                    productObject._id = productData.priceBookDetails._id
                    productObject.name = productData.priceBookDetails.name
                    productObject.categoryId = productData.priceBookDetails.category
                    productObject.term = productData.priceBookDetails.term
                    productObject.adminFee = productData.priceBookDetails.adminFee
                    productObject.brokerFee = productData.dealerPriceBookDetails.brokerFee
                    productObject.dealerPriceId = productData.dealerPriceBookDetails._id
                    products.push(productObject)

                }
                reportingData.products = products
                reportingToSave.push(reportingData)
            }
        }

        let saveData = await supportingFunction.insertManyReporting(reportingToSave)
        if (saveData) {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "order/editOrderDetail catch",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.reportingDataReCreation = async (req, res) => {
    try {

        let getReportings = await supportingFunction.checkReporting()
        let orderId = getReportings.map(ID => new mongoose.Types.ObjectId(ID.orderId))

        let getAllOrders = await orderService.getAllOrders1([
            {
                $match: {
                    $and: [
                        { _id: { $nin: orderId } },
                        { "status": "Active" }
                    ]
                }
            }
        ])

        if (!getAllOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the orders"
            })
        }

        let reportingToSave = []
        for (let i = 0; i < getAllOrders.length; i++) {
            let orderData = getAllOrders[i]
            let checkOrderId = await supportingFunction.checkReportinWithId({ orderId: orderData._id })
            if (!checkOrderId) {
                let reportingData = {}
                let products = []
                reportingData.orderId = orderData._id
                reportingData.orderAmount = orderData.orderAmount
                reportingData.dealerId = orderData.dealerId
                reportingData.createdAt = orderData.updatedAt
                reportingData.updatedAt = orderData.updatedAt

                for (let p = 0; p < orderData.productsArray.length; p++) {
                    productData = orderData.productsArray[p]
                    let productObject = {}
                    productObject.price = productData.price
                    productObject.noOfProducts = productData.checkNumberProducts
                    productObject.retailPrice = productData.dealerPriceBookDetails.retailPrice
                    productObject.frontingFee = productData.priceBookDetails.frontingFee
                    productObject.reserveFutureFee = productData.priceBookDetails.reserveFutureFee
                    productObject.reinsuranceFee = productData.priceBookDetails.reinsuranceFee
                    productObject._id = productData.priceBookDetails._id
                    productObject.name = productData.priceBookDetails.name
                    productObject.categoryId = productData.priceBookDetails.category
                    productObject.term = productData.priceBookDetails.term
                    productObject.adminFee = productData.priceBookDetails.adminFee
                    productObject.brokerFee = productData.dealerPriceBookDetails.brokerFee
                    productObject.dealerPriceId = productData.dealerPriceBookDetails._id
                    products.push(productObject)

                }
                reportingData.products = products
                reportingToSave.push(reportingData)
            }
        }

        let saveData = await supportingFunction.insertManyReporting(reportingToSave)
        if (saveData) {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "order/editOrderDetail catch",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};