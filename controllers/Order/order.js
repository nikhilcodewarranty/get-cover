require("dotenv").config()
const orderService = require("../../services/Order/orderService");
const supportingFunction = require('../../config/supportingFunction')
const LOG = require('../../models/User/logs')
const emailConstant = require('../../config/emailConstant');
const dealerService = require("../../services/Dealer/dealerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
// const maillogservice = require("../../services/User/maillogServices");

const resellerService = require("../../services/Dealer/resellerService");
const servicerService = require("../../services/Provider/providerService");
const contractService = require("../../services/Contract/contractService");
const customerService = require("../../services/Customer/customerService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const constant = require("../../config/constant")
const maillogservice = require("../../services/User/maillogServices");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const userService = require("../../services/User/userService");
const claimService = require("../../services/Claim/claimService");
const pdf = require('html-pdf');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const XLSX = require("xlsx");
const fs = require("fs");
const moment = require("moment");
const PDFDocument = require('pdfkit');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

aws.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
});
const S3 = new aws.S3();
const S3Bucket = new aws.S3();
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
        let userDealerIds = ordersResult.map((result) => result.dealerId);
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId);

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
            .map(result => result.customerId);

        const customerCreteria = { _id: { $in: customerIdsArray } };

        const allUserIds = mergedArray.concat(userCustomerIds);

        const getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: allUserIds }, isPrimary: true } } }
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
                username = getPrimaryUser.find(user => user.metaId.toString() === item.dealerName._id.toString());
            }
            if (item.resellerName._id) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.metaId.toString() === item.resellerName._id.toString()) : {};
            }
            if (item.customerName._id) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.metaId.toString() === item.customerName._id.toString()) : {};
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

//Get customer for order
exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        if (data.resellerId != "" && data.resellerId != undefined) {
            // query = { dealerId: data.dealerId, resellerId: data.resellerId };
            query = [
                {
                    $match: {
                        $and: [
                            {
                                dealerId: new mongoose.Types.ObjectId(data.dealerId)
                            },
                            {
                                resellerId1: new mongoose.Types.ObjectId(data.resellerId)
                            }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "resellers",
                        localField: 'resellerId1',
                        foreignField: '_id',
                        as: "resellerData"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        username: 1,
                        street: 1,
                        city: 1,
                        zip: 1,
                        unique_key: 1,
                        state: 1,
                        country: 1,
                        dealerId: 1,
                        isAccountCreate: 1,
                        resellerId: 1,
                        resellerId1: 1,
                        dealerName: 1,
                        status: 1,
                        accountStatus: 1,
                        isDeleted: 1,
                        'resellerStatus': { $arrayElemAt: ["$resellerData.status", 0] },

                    }
                }
            ]
        } else {
            // query = { dealerId: data.dealerId };
            query = [
                {
                    $match: { dealerId: new mongoose.Types.ObjectId(data.dealerId) }
                },
                {
                    $lookup: {
                        from: "resellers",
                        localField: 'resellerId1',
                        foreignField: '_id',
                        as: "resellerData"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        username: 1,
                        street: 1,
                        city: 1,
                        zip: 1,
                        unique_key: 1,
                        state: 1,
                        country: 1,
                        dealerId: 1,
                        isAccountCreate: 1,
                        resellerId: 1,
                        resellerId1: 1,
                        dealerName: 1,
                        status: 1,
                        accountStatus: 1,
                        isDeleted: 1,
                        'resellerStatus': { $arrayElemAt: ["$resellerData.status", 0] },

                    }
                }
            ]
        }
        let getCustomers = await customerService.getCustomerByAggregate(query, {});

        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers",
            });
            return;
        }
        const customerIds = getCustomers.map(customer => customer._id);

        const customerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: { $in: customerIds }, isPrimary: true } } }
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

        const result_Array = customerUser.map(item1 => {
            const matchingItem = getCustomers.find(item2 => item2._id.toString() === item1.metaId.toString());
            if (matchingItem) {
                return {
                    ...matchingItem,
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

// get servicer list by order ID
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

        const servicerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: { $in: servicerIds }, isPrimary: true } } }
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



        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }

        const result_Array = servicer.map((item1) => {
            const matchingItem = servicerUser.find(
                (item2) => item2.metaId.toString() === item1._id.toString()
            );

            if (matchingItem) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
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

        //get coverage type based on dealer coverageType
        let coverageType = checkDealer.coverageType

            // coverageType = coverageType.map(type=>type.value)
            ;
        const optionQuery = {
            value: {
                $elemMatch: {
                    value: { $in: coverageType }
                }
            }
        }
        const dynamicOption = await userService.getOptions(optionQuery)

        const filteredOptions = dynamicOption.value.filter(item => coverageType.includes(item.value));

        checkDealer.coverageType = filteredOptions

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

//Get category and priceBooks
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
        if (data.dealerSku != "") {
            getDealerPriceBook = getDealerPriceBook.filter(item => item.dealerSku == data.dealerSku)
        }
        if (!data.coverageType) {
            res.send({
                code: constant.errorCode,
                message: "Coverage type is required",
            });
            return;
        }
        const coverageType = data.coverageType;
        // price book ids array from dealer price book
        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);

        let newQuery = {
            _id: { $in: dealerPriceIds }, "coverageType.value": { "$all": coverageType },
            "coverageType": { "$size": coverageType.length }, status: true,
        };

        let getPriceBooksForAllCat = await priceBookService.getAllPriceIds(newQuery, {});

        let uniqueCategory1 = {};

        let uniqueCategories1 = getPriceBooksForAllCat.filter((item) => {
            if (!uniqueCategory1[item.category.toString()]) {
                uniqueCategory1[item.category.toString()] = true;
                return true;
            }
            return false;
        });

        uniqueCategories1 = uniqueCategories1.map((item) => item.category);
        let getCategories1 = await priceBookService.getAllPriceCat(
            { _id: { $in: uniqueCategories1 } },
            {}
        );
        let query;
        if (data.term != "" && data.pName == "") {
            query = {
                _id: { $in: dealerPriceIds }, status: true, term: data.term, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };
        }

        else if (data.pName != "" && data.term == "") {
            query = {
                _id: { $in: dealerPriceIds }, status: true, pName: data.pName, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };

        } else if (data.term != "" && data.pName != "") {
            query = {
                _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };
        } else {
            query = {
                _id: { $in: dealerPriceIds }, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }, status: true,
            };
        }

        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {});
        if (data.priceBookId || data.priceBookId != "") {
            getPriceBooks = await priceBookService.getAllPriceIds({ _id: data.priceBookId }, {});
            getDealerPriceBook = getDealerPriceBook.filter(item => item.priceBook == data.priceBookId)
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

            if (mergedPriceBooks.length > 0) {
                let dealerSkuPrice = mergedPriceBooks.map((item) => item._id);

                let condition = { priceBook: { $in: dealerSkuPrice }, dealerId: req.params.dealerId };

                dealerPriceBookDetail = await dealerPriceService.findAllDealerPrice(condition);

            }

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
        if (mergedPriceBooks.length > 0) {
            let priceIds = mergedPriceBooks.map(ID => ID._id)
            getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
                dealerId: req.params.dealerId,
                status: true,
                priceBook: { $in: priceIds }
            });
        }
        mergedPriceBooks = mergedPriceBooks.map((item) => {
            // Find the matching dealerPriceBookDetail object
            const matchingDetail = getDealerPriceBook.find(detail =>
                item._id.toString() === detail.priceBook.toString()
            );

            // If a match is found, add the dealerSku key
            if (matchingDetail) {
                return {
                    ...item,
                    dealerSku: matchingDetail.dealerSku
                };
            }

            // If no match, return the item unchanged
            return item;
        });

        //Get Coverage type according to dealer price books
        let mergedData;

        if (mergedPriceBooks.length == 1) {
            let getDealerPriceBookData = getDealerPriceBook.filter(dealerPrice => {
                return dealerPrice.dealerSku == mergedPriceBooks[0].dealerSku
            })

            let adhDays = getDealerPriceBookData[0].adhDays

            const adhType = adhDays.map(item => item.value)
            const optionQuery = {
                value: {
                    $elemMatch: {
                        value: { $in: adhType }
                    }
                }
            }
            const dynamicOption = await userService.getOptions(optionQuery)
            const filteredOptions = dynamicOption.value.filter(item => coverageType.includes(item.value));

            mergedData = adhDays.map(adh => {
                const match = filteredOptions.find(opt => opt.value === adh.value);
                if (match) {
                    return { label: match.label, value: match.value, waitingDays: adh.waitingDays, deductible: adh.deductible, amountType: adh.amountType }

                }

                return adh;
            });
        }

        else {
            mergedData = []
        }

        let result = {
            priceCategories: getCategories1,
            dealerPriceBook: getDealerPriceBook,
            mergedData,
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
};

//Check Purchase order
exports.checkPurchaseOrder = async (req, res) => {
    try {
        let checkPurchaseOrder;
        let data = req.body;
        let dealerIdToCheck;
        if (req.role == "Dealer") {
            dealerIdToCheck = req.userId
        }
        if (req.role == "Reseller") {
            let getResellerData = await resellerService.getReseller({ _id: req.userId })
            dealerIdToCheck = getResellerData.dealerId
        }
        if (
            data.oldDealerPurchaseOrder != "" &&
            data.oldDealerPurchaseOrder != data.dealerPurchaseOrder
        ) {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId ? req.body.dealerId : dealerIdToCheck,
                },
                { isDeleted: 0 }
            );
        } else if (data.oldDealerPurchaseOrder == "") {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId ? req.body.dealerId : dealerIdToCheck,
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
                message: "Order is already active, please refresh the page",
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
        //Get submitted user
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        const adminArcheiveOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.archivinOrder": true },
                        { status: true },
                        { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                    ]
                }
            },
        }
        const dealerArcheiveOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.archivinOrder": true },
                        { status: true },
                        { metaId: checkOrder.dealerId },
                    ]
                }
            },
        }
        const resellerArcheiveOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.archivinOrder": true },
                        { status: true },
                        { metaId: checkOrder.resellerId ? checkOrder.resellerId : "000008041eb1acda24111111" },
                    ]
                }
            },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminArcheiveOrderQuery, { email: 1, metaData: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerArcheiveOrderQuery, { email: 1, metaData: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerArcheiveOrderQuery, { email: 1, metaData: 1 })
        //send notification to dealer,reseller,admin,customer

        let IDs = adminUsers.map(user => user._id)
        let IDs1 = dealerUsers.map(user => user._id)
        let IDs2 = resellerUsers.map(user => user._id)
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
        let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
        let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })

        let notificationData1 = {
            title: "Order Archived Successfully",
            description: `The Order # ${checkOrder.unique_key} has been archived successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0].lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'Order Archieved',
            redirectionId: "archiveOrder",
            endPoint: base_url + `archiveOrder/${checkOrder.unique_key}`,
            notificationFor: IDs
        };
        let notificationData2 = {
            title: "Order Archived Successfully",
            description: `The Order # ${checkOrder.unique_key} has been archived successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0].lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'Order Archieved',
            redirectionId: "dealer/archiveOrder",
            endPoint: base_url + `dealer/archiveOrder/${checkOrder.unique_key}`,
            notificationFor: IDs1
        };
        let notificationData3 = {
            title: "Order Archived Successfully",
            description: `The Order # ${checkOrder.unique_key} has been archived successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0].lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'Order Archieved',
            redirectionId: "reseller/archiveOrder",
            endPoint: base_url + `reseller/archiveOrder/${checkOrder.unique_key}`,
            notificationFor: IDs2
        };
        let notificationArrayData = [];
        notificationArrayData.push(notificationData1)
        notificationArrayData.push(notificationData2)
        notificationArrayData.push(notificationData3)
        let createNotification = await userService.saveNotificationBulk(notificationArrayData);
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
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)
        let resellerEmails = resellerUsers.map(user => user.email)
        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        let settingData = await userService.getSetting({});
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: '',
            content: "The order " + checkOrder.unique_key + " has been archeived!.",
            subject: "Archeive Order",
            redirectId: base_url + `archiveOrder/${checkOrder.unique_key}`
        }
        if (checkOrder.sendNotification) {
            let mailing
            if (notificationEmails.length > 0) {
                mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
            }
            emailData.redirectId = base_url + `archiveOrder/${checkOrder.unique_key}`
            if (dealerEmails.length > 0) {
                mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
                maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)
            }


            emailData.redirectId = base_url + `dealer/archiveOrder/${checkOrder.unique_key}`
            if (resellerEmails.length > 0) {
                emailData.redirectId = base_url + `reseller/archiveOrder/${checkOrder.unique_key}`
                mailing = await sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
                maillogservice.createMailLogFunction(mailing, emailData, resellerUsers, process.env.update_status)
            }


        }
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
        //Get dynamic options
        const dynamicOption = await userService.getOptions({ name: "coverage_type" })
        checkOrder.productsArray = await Promise.all(checkOrder.productsArray.map(async (product) => {
            const pricebook = await priceBookService.findByName1({ _id: product.priceBookId });
            const dealerPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: product.priceBookId, dealerId: checkOrder.dealerId }, { isDeleted: false });
            const pricebookCat = await priceBookService.getPriceCatByName({ _id: product.categoryId });
            // Initialize mergedData to store matched data
            product.mergedData = [];

            // Loop through dynamicOption values and match them with adhDays
            // dynamicOption.value.forEach(option => {
            //     const matchedAdhDay = product.adhDays.find(adhDay => adhDay.value === option.value);

            //     if (matchedAdhDay) {
            //         product.mergedData.push({
            //             label: option.label,
            //             value: matchedAdhDay.value,
            //             waitingDays: matchedAdhDay.waitingDays,
            //             deductible: matchedAdhDay.deductible,
            //             amountType: matchedAdhDay.amountType
            //         });
            //     }
            // });

            product.adhDays.forEach(adhItem => {
                const matchedOption = dynamicOption.value.find(option => option.value === adhItem.value);

                if (matchedOption) {
                    product.mergedData.push({
                        label: matchedOption.label,
                        value: adhItem.value,
                        waitingDays: adhItem.waitingDays,
                        deductible: adhItem.deductible,
                        amountType: adhItem.amountType
                    });
                }
            });


            if (pricebook) {
                product.name = pricebook.name;
                product.pName = pricebook.pName;
                product.dealerSku = dealerPriceBook.dealerSku
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
        //Get primary user of the dealer for the order

        const singleDealerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } }
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
        //Get primary user of the reseller for the order

        const singleResellerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } }
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
        //Get primary user of the customer for the order

        const singleCustomerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } }
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

        // ------------------------------------Get Dealer Servicer -----------------------------
        let getServicersIds = await dealerRelationService.getDealerRelations({
            dealerId: checkOrder.dealerId,
        });

        let ids = getServicersIds.map((item) => item.servicerId);

        servicer = await servicerService.getAllServiceProvider(
            { _id: { $in: ids }, status: true },
            {}
        );

        // if (checkOrder.resellerId != null) {
        //     var checkReseller = await resellerService.getReseller({
        //         _id: checkOrder.resellerId,
        //     });
        // }


        // if (reseller && reseller.isServicer) {
        //     if (reseller.status) {
        //         servicer.unshift(reseller);
        //     }
        // }

        let dealerResellerServicer = await resellerService.getResellers({ dealerId: checkOrder.dealerId, isServicer: true, status: true })
        let resellerIds = dealerResellerServicer.map(resellers => resellers._id);

        if (dealerResellerServicer.length > 0) {
            let dealerResellerServicer = await servicerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
            servicer = servicer.concat(dealerResellerServicer);
        }

        if (dealer && dealer.isServicer) {
            if (dealer.accountStatus) {
                let dealerServicer = await servicerService.getAllServiceProvider({ dealerId: { $in: dealer._id } })

                servicer = servicer.concat(dealerServicer);
            }
        }


        let servicerIds = servicer.map((obj) => obj._id);
        const servicerIds1 = servicer.map((obj) => new mongoose.Types.ObjectId(obj.dealerId));
        const servicerIds2 = servicer.map((obj) => new mongoose.Types.ObjectId(obj.resellerId));
        servicerIds = servicerIds.concat(servicerIds1)
        servicerIds = servicerIds.concat(servicerIds2)

        //Get servicer for the order

        const servicerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: { $in: servicerIds }, isPrimary: true } } }
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

        let result_Array = servicer.map((item1) => {
            const matchingItem = servicerUser.find(
                (item2) => item2.metaId.toString() === item1?._id?.toString() || item2?.metaId?.toString() === item1?.dealerId?.toString() || item2.metaId?.toString() === item1?.resellerId?.toString()
            );

            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: matchingItem
                };
            } else {
                return {};
            }
        });
        //Get setting of website
        let settingData = await userService.getSetting({});
        let userData = {
            dealerData: dealer ? dealer : {},
            customerData: customer ? customer : {},
            websiteSetting: {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                paymentDetail: settingData[0]?.paymentDetail,
                title: settingData[0]?.title,
                darkLogoName: settingData[0]?.logoDark.fileName,
                lightLogoName: settingData[0]?.logoLight.fileName,
            },
            resellerData: reseller ? reseller : {},
            username: singleDealerUser[0] ? singleDealerUser[0] : {},
            resellerUsername: singleResellerUser[0] ? singleResellerUser[0] : {},
            customerUserData: singleCustomerUser[0] ? singleCustomerUser[0] : {},
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
        checkOrder.bucket_name = process.env.bucket_name
        res.send({
            code: constant.successCode,
            message: "Success!",
            result: checkOrder,
            bucket_name: process.env.bucket_name,
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
        let orderServiceCoverageType = savedResponse.serviceCoverageType
        let currentYear = new Date().getFullYear();
        let currentYearWithoutHypen = new Date().getFullYear();

        console.log(currentYear); // Outputs: 2024
        currentYear = "-" + currentYear + "-"
        let count1 = await contractService.getContractsCountNew({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });
        var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
        let checkLength = savedResponse.productsArray.length - 1
        let save = savedResponse.productsArray.map(async (product, index) => {
            const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
            let headerLength;
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
            let coverageStartDate1 = product.coverageStartDate1;
            let coverageEndDate1 = product.coverageEndDate1;
            let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
            let projection = { isDeleted: 0 };
            let priceBook = await priceBookService.getPriceBookById(
                query,
                projection
            );
            //dealer Price Book
            let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: savedResponse.dealerId };

            let dealerPriceBook = await dealerPriceService.getDealerPriceById(
                dealerQuery,
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
            const bucketReadUrl = { Bucket: process.env.bucket_name, Key: product.orderFile.fileName };
            // Await the getObjectFromS3 function to complete
            const result = await getObjectFromS3(bucketReadUrl);
            headerLength = result.headers
            if (headerLength.length !== 8) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid file format detected. The sheet should contain exactly four columns."
                })
                return
            }
            const totalDataComing1 = result.data;
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
                let unique_key_search1 = "OC" + currentYearWithoutHypen + unique_key_number1
                let unique_key1 = "OC" + currentYear + unique_key_number1
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

                // Find the minimum date
                let minDate;
                let adhDaysArray = product.adhDays

                adhDaysArray.sort((a, b) => a.waitingDays - b.waitingDays);


                const futureDate = new Date(product.coverageStartDate);
                let minDate1 = futureDate.setDate(futureDate.getDate() + adhDaysArray[0].waitingDays);

                if (!product.isManufacturerWarranty) {
                    if (adhDaysArray.length == 1) {
                        const hasBreakdown = adhDaysArray.some(item => item.value === 'breakdown');
                        if (hasBreakdown) {
                            let minDate2
                            if (orderServiceCoverageType == "Parts") {
                                minDate2 = partsWarrantyDate1
                            } else if (orderServiceCoverageType == "Labour" || orderServiceCoverageType == "Labor") {
                                minDate2 = labourWarrantyDate1
                            } else {
                                if (partsWarrantyDate1 > labourWarrantyDate1) {
                                    minDate2 = labourWarrantyDate1
                                } else {
                                    minDate2 = partsWarrantyDate1
                                }
                            }
                            if (minDate1 > minDate2) {
                                minDate = minDate1
                            }
                            if (minDate1 < minDate2) {
                                minDate = minDate2
                            }
                        } else {
                            minDate = minDate1
                        }
                    }
                    else {
                        minDate = minDate1
                    }

                } else {
                    minDate = minDate1
                }
                minDate = new Date(minDate).setHours(0, 0, 0, 0)
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
                    minDate: new Date(minDate),
                    dealerSku: dealerPriceBook.dealerSku,
                    coverageStartDate: coverageStartDate,
                    coverageStartDate1: coverageStartDate1,
                    coverageEndDate1: coverageEndDate1,
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
                    adhDays: product.adhDays,
                    noOfClaimPerPeriod: product.noOfClaimPerPeriod,
                    noOfClaim: product.noOfClaim,
                    isManufacturerWarranty: product.isManufacturerWarranty,
                    isMaxClaimAmount: product.isMaxClaimAmount,
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
                if (checkOrder?.termCondition) {
                    const tcResponse = await generateTC(savedResponse);
                }
                // send notification to dealer,admin, customer
                const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
                const base_url = `${process.env.SITE_URL}`
                let adminMarkAsPaidQuery = {
                    metaData: {
                        $elemMatch: {
                            $and: [
                                { "orderNotifications.makingOrderPaid": true },
                                { status: true },
                                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                            ]
                        }
                    },
                }

                let dealerMarkAsPaidQuery = {
                    metaData: {
                        $elemMatch: {
                            $and: [
                                { "orderNotifications.makingOrderPaid": true },
                                { status: true },
                                { metaId: checkOrder.dealerId },
                            ]
                        }
                    },
                }

                let resellerMarkAsPaidQuery = {
                    metaData: {
                        $elemMatch: {
                            $and: [
                                { "orderNotifications.makingOrderPaid": true },
                                { status: true },
                                { metaId: checkOrder.resellerId },
                            ]
                        }
                    },
                }

                let customerMarkAsPaidQuery = {
                    metaData: {
                        $elemMatch: {
                            $and: [
                                { "orderNotifications.makingOrderPaid": true },
                                { status: true },
                                { metaId: checkOrder.customerId },
                            ]
                        }
                    },
                }
                let adminUsers = await supportingFunction.getNotificationEligibleUser(adminMarkAsPaidQuery, { email: 1, metaData: 1 })
                let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerMarkAsPaidQuery, { email: 1, metaData: 1 })
                let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerMarkAsPaidQuery, { email: 1, metaData: 1 })
                let customerUsers = await supportingFunction.getNotificationEligibleUser(customerMarkAsPaidQuery, { email: 1, metaData: 1 })
                let IDs = adminUsers.map(user => user._id)
                let IDs1 = dealerUsers.map(user => user._id)
                let IDs2 = resellerUsers.map(user => user._id)
                let IDs3 = customerUsers.map(user => user._id)
                let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
                let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
                let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
                let notificationArrayData = []
                let notificationData1 = {
                    title: "Order Marked Paid Successfully",
                    description: `The Order # ${checkOrder.unique_key} has been marked completed in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
                    userId: req.teammateId,
                    contentId: checkOrder._id,
                    flag: 'order',
                    redirectionId: "orderDetails/" + checkOrder._id,
                    endPoint: base_url + "orderDetails/" + checkOrder._id,
                    notificationFor: IDs
                };
                let notificationData2 = {
                    title: "Order Marked Paid Successfully",
                    description: `The Order # ${checkOrder.unique_key} has been marked completed in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
                    userId: req.teammateId,
                    contentId: checkOrder._id,
                    flag: 'order',
                    redirectionId: "dealer/orderDetails/" + checkOrder._id,
                    endPoint: base_url + "dealer/orderDetails/" + checkOrder._id,
                    notificationFor: IDs1
                };
                let notificationData3 = {
                    title: "Order Marked Paid Successfully",
                    description: `The Order # ${checkOrder.unique_key} has been marked completed in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
                    userId: req.teammateId,
                    contentId: checkOrder._id,
                    flag: 'order',
                    redirectionId: "reseller/orderDetails/" + checkOrder._id,
                    endPoint: base_url + "reseller/orderDetails/" + checkOrder._id,
                    notificationFor: IDs2
                };
                let notificationData4 = {
                    title: "Order Marked Paid Successfully",
                    description: `The Order # ${checkOrder.unique_key} has been marked completed in the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}`,
                    userId: req.teammateId,
                    contentId: checkOrder._id,
                    flag: 'order',
                    redirectionId: "customer/orderDetails/" + checkOrder._id,
                    endPoint: base_url + "customer/orderDetails/" + checkOrder._id,
                    notificationFor: IDs3
                };
                notificationArrayData.push(notificationData1);
                notificationArrayData.push(notificationData2);
                notificationArrayData.push(notificationData3);
                notificationArrayData.push(notificationData4);
                let createNotification = await userService.saveNotificationBulk(notificationArrayData);
                // Send Email code here
                let notificationEmails = adminUsers.map(user => user.email)
                let dealerEmails = dealerUsers.map(user => user.email)
                let resellerEmails = resellerUsers.map(user => user.email)
                let customerEmails = customerUsers.map(user => user.email)
                let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails, customerEmails)
                //Email to Dealer
                let settingData = await userService.getSetting({});
                //Email to Dealer
                let emailData = {
                    darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                    lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                    address: settingData[0]?.address,
                    websiteSetting: settingData[0],
                    senderName: '',
                    content: `Congratulations, your order # ${savedResponse.unique_key} has been created in our system. Please login to the system and view your order details. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                    subject: "Mark as paid",
                    redirectId: base_url + "orderDetails/" + checkOrder._id,
                }


                if (Object.keys(checkOrder.termCondition).length == 0) {
                    console.log("I am gereee");
                    let mailing
                    if (notificationEmails.length > 0) {
                        mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                        console.log("adminUsers", adminUsers);
                        console.log("mailing1", adminUsers);

                        maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

                    }
                    if (dealerEmails.length > 0) {
                        emailData.redirectId = base_url + "dealer/orderDetails/" + checkOrder._id
                        mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
                        console.log("mailing2", mailing);

                        maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)

                    }
                    if (resellerEmails.length > 0) {
                        emailData.redirectId = base_url + "reseller/orderDetails/" + checkOrder._id
                        mailing = await sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
                        console.log("mailing3", mailing);

                        maillogservice.createMailLogFunction(mailing, emailData, resellerUsers, process.env.update_status)

                    }
                    if (customerEmails.length > 0) {
                        emailData.redirectId = base_url + "customer/orderDetails/" + checkOrder._id
                        mailing = await sgMail.send(emailConstant.sendEmailTemplate(customerEmails, ["noreply@getcover.com"], emailData))
                        console.log("mailing4", mailing);

                        maillogservice.createMailLogFunction(mailing, emailData, customerUsers, process.env.update_status)

                    }



                }
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
                    data: XLSX.utils.sheet_to_json(sheet, {
                        raw: false, // this ensures all cell values are parsed as text
                        dateNF: 'mm/dd/yyyy', // optional: specifies the date format if Excel stores dates as numbers
                        defval: '', // fills in empty cells with an empty string
                        cellDates: true, // ensures dates are parsed as JavaScript Date objects
                        cellText: false, // don't convert dates to text
                    }),
                };

                resolve(result);
            }
        });
    });
};

// get the pdf file with order ID
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

        const queryDealerUser = { metaId: { $in: [checkOrder[0].order[0].dealerId != null ? checkOrder[0].order[0].dealerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

        const queryResselerUser = { metaId: { $in: [checkOrder[0].order[0].resellerId != null ? checkOrder[0].order[0].resellerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

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
};

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
        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { _id: req.body.servicerId },
                { dealerId: req.body.servicerId },
                { resellerId: req.body.servicerId }]
        })
        let creteria = { _id: req.params.orderId }
        let update = await orderService.updateOrder(creteria, { servicerId: checkServicer._id }, { new: true })
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

//get reseller by dealer and customer
exports.getResellerByDealerAndCustomer = async (req, res) => {
    try {
        let data = req.body
        let getCustomer = await customerService.getCustomerByName({ _id: data.customerId })

        let getReseller = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: new mongoose.Types.ObjectId(getCustomer.resellerId) } } },
                        { metaData: { $elemMatch: { isPrimary: true } } },
                    ]
                }
            },
            {
                $lookup: {
                    from: "resellers",
                    localField: "metaData.metaId",
                    foreignField: "_id",
                    as: "resellerData"
                }
            },
            {
                $project: {
                    resellerData: 1,
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
        const customerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        let otherInfo = []

        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            return contractService.getContractById({
                orderProductId: item._id
            });

        })
        const contractArray = await Promise.all(contractArrayPromise);


        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            let anotherObj = {
                coverageStartDate: checkOrder?.productsArray[i]?.coverageStartDate,
                coverageEndDate: checkOrder?.productsArray[i]?.coverageEndDate,
                term: checkOrder?.productsArray[i]?.term
            }
            otherInfo.push(anotherObj)
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: checkOrder?.productsArray[i]?.dealerSku,
                        noOfProducts: quanitityProduct.enterQuantity,

                    }
                    productCoveredArray.push(obj)


                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract?.dealerSku,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts,

                }
                productCoveredArray.push(obj)
            }

        }
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');


        const coverageStartDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageStartDate).format("MM/DD/YYYY")}</p>
`).join('');

        const coverageEndDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageEndDate).format("MM/DD/YYYY")}</p>
`).join('');

        const term = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${product.term / 12} ${product.term / 12 === 1 ? 'Year' : 'Years'}</p>
`).join('');


        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.servicerId, isPrimary: true } } }, { isDeleted: false })

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
        //  const orderFile = 'pdfs/' + mergeFileName;
        const orderFile = `/tmp/${mergeFileName}`; // Temporary local storage
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
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''}, ${checkCustomer ? checkCustomer?.city : ''}, ${checkCustomer ? checkCustomer?.state : ''}, ${checkCustomer ? checkCustomer?.country : ''}</td>
                   </tr>
                      <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${coverageStartDates}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${term} 
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${coverageEndDates}</td >
          </tr >
        
       
            <tr>
                <td style="font-size:13px;padding:15px;">Number of covered components:</td>
               <td> ${tableRows}   </td>                 
            </tr >
            
        </table > `;

        pdf.create(html, options).toFile(orderFile, async (err, result) => {
            if (err) return console.log(err);
            const { PDFDocument, rgb } = require('pdf-lib');
            const fs = require('fs').promises;
            const fileContent = await fs.readFile(orderFile);
            const bucketName = process.env.bucket_name
            const s3Key = `pdfs/${mergeFileName}`;
            //Upload to S3 bucket
            await uploadToS3(orderFile, bucketName, s3Key);
            const termConditionFile = checkOrder.termCondition.fileName
            const termPath = termConditionFile
            //Download from S3 bucket 
            const termPathBucket = await downloadFromS3(bucketName, termPath);

            const orderPathBucket = await downloadFromS3(bucketName, s3Key);

            async function mergePDFs(pdfBytes1, pdfBytes2, outputPath) {
                const pdfDoc1 = await PDFDocument.load(pdfBytes1);
                const pdfDoc2 = await PDFDocument.load(pdfBytes2);

                const mergedPdf = await PDFDocument.create();

                const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                const mergedPdfBytes = await mergedPdf.save();

                await fs.writeFile(outputPath, mergedPdfBytes);
                return mergedPdfBytes;
            }

            // Merge PDFs
            const mergedPdf = await mergePDFs(termPathBucket, orderPathBucket, `/tmp/merged_${mergeFileName}`);
            // Upload merged PDF to S3
            const mergedKey = `mergedFile/${mergeFileName}`;
            await uploadToS3(`/tmp/merged_${mergeFileName}`, bucketName, mergedKey);
            const params = {
                Bucket: bucketName,
                Key: `mergedFile/${mergeFileName}`
            };
            //Read from the s3 bucket
            const data = await S3.getObject(params).promise();
            let attachment = data.Body.toString('base64');
            //sendTermAndCondition
            // Send Email code here


            const dealerActiveOrderQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "orderNotifications.makingOrderPaid": true },
                            { status: true },
                            { metaId: checkOrder.dealerId },
                        ]
                    }
                },
            }

            const resellerActiveOrderQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "orderNotifications.makingOrderPaid": true },
                            { status: true },
                            { metaId: checkOrder.resellerId ? checkOrder.resellerId : "000008041eb1acda24111111" },
                        ]
                    }
                },
            }

            const customerActiveOrderQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "orderNotifications.makingOrderPaid": true },
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
            let adminUsers = await supportingFunction.getNotificationEligibleUser(adminActiveOrderQuery, { email: 1, metaData: 1 })
            let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerActiveOrderQuery, { email: 1, metaData: 1 })
            let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerActiveOrderQuery, { email: 1, metaData: 1 })
            let customerUsers = await supportingFunction.getNotificationEligibleUser(customerActiveOrderQuery, { email: 1, metaData: 1 })

            let notificationEmails = adminUsers.map(user => user.email)
            let dealerEmails = dealerUsers.map(user => user.email)
            let resellerEmails = resellerUsers.map(user => user.email)
            let customerEmails = customerUsers.map(user => user.email)
            const base_url = `${process.env.SITE_URL}`

            let settingData = await userService.getSetting({});
            let emailData = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName: '',
                content: `Congratulations, your order # ${checkOrder.unique_key} has been created in our system. Please login to the system and view your order details. Also, we have attached our T&C to the email for the review. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                subject: "Process Order",
                redirectId: base_url + "orderDetails/" + checkOrder._id
            }
            let mailing
            if (notificationEmails.length > 0) {
                mailing = await sgMail.send(emailConstant.sendTermAndCondition(notificationEmails, ["noreply@getcover.com"], emailData, attachment))
                maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

            }
            if (dealerEmails.length > 0) {
                emailData.redirectId = base_url + "dealer/orderDetails/" + checkOrder._id
                mailing = await sgMail.send(emailConstant.sendTermAndCondition(dealerEmails, ["noreply@getcover.com"], emailData, attachment))
                maillogservice.createMailLogFunction(mailing, emailData, dealerUsers, process.env.update_status)


            }
            if (customerEmails.length > 0) {
                emailData.redirectId = base_url + "customer/orderDetails/" + checkOrder._id
                mailing = await sgMail.send(emailConstant.sendTermAndCondition(customerEmails, ["noreply@getcover.com"], emailData, attachment))
                maillogservice.createMailLogFunction(mailing, emailData, customerUsers, process.env.update_status)


            }
            if (resellerEmails.length > 0) {
                emailData.redirectId = base_url + "reseller/orderDetails/" + checkOrder._id
                mailing = await sgMail.send(emailConstant.sendTermAndCondition(resellerEmails, ["noreply@getcover.com"], emailData, attachment))
                maillogservice.createMailLogFunction(mailing, emailData, resellerUsers, process.env.update_status)
            }



        })
        return 1

    }
    catch (err) {
        console.log("check +++++++++++++++++++++++++++++++++++++++++++++++", err.message)
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
}

//Upload to S3
const uploadToS3 = async (filePath, bucketName, key) => {
    const fs = require('fs').promises;
    const fileContent = await fs.readFile(filePath);
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
    };
    return S3.upload(params).promise();
};

//Download to S3
const downloadFromS3 = async (bucketName, key) => {
    const params = {
        Bucket: bucketName,
        Key: key,
    };
    const data = await S3.getObject(params).promise();
    return data.Body;
};
