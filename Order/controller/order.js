const { Order } = require("../model/order");
require("dotenv").config()
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
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
const { createPdf } = require("pdfmake")

var StorageP = multer.diskStorage({
    destination: function (req, files, cb) {
        cb(null, path.join(__dirname, "../../uploads/orderFile"));
    },
    filename: function (req, files, cb) {
        cb(
            null,
            files.fieldname + "-" + Date.now() + path.extname(files.originalname)
        );
    },
});

var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array("file", 100);

var uploadP = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).single("file");

exports.createOrder = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body;
            // let data = {
            //     "dealerId": "65ce11c8750ebbaea9330274",
            //     "servicerId": "",
            //     "customerId": "65cf188810d67d4db2c352a6",
            //     "resellerId": "",
            //     "productsArray": [
            //         {
            //             "categoryId": "65cf04494e8b028678173521",
            //             "priceBookId": "65cf04ba4e8b028678173522",
            //             "unitPrice": "80.00",
            //             "noOfProducts": "1",
            //             "price": 160,
            //             "file": "",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123",
            //             "serial": "S123GHK",
            //             "condition": "Breakdown",
            //             "productValue": 123,
            //             "regDate": "2024-01-18T00:00:00.000Z",
            //             "coverageStartDate": "2024-01-30T00:00:00.000Z",
            //             "coverageEndDate": "2025-01-30T00:00:00.000Z",
            //             "description": "003",
            //             "term": 12,
            //             "priceType": "Quantity Pricing",
            //             "additionalNotes": "this is test ",
            //             "QuantityPricing": '[{"name":"test","quantity":100,"_id":"65b123f200c340451867e281","enterQuantity":"7878"}]'

            //         }

            //     ],
            //     "sendNotification": true,
            //     "paymentStatus": "Paid",
            //     "dealerPurchaseOrder": "#136789777",
            //     "serviceCoverageType": "Parts",
            //     "coverageType": "Breakdown",
            //     "orderAmount": 144,
            //     "paidAmount": 123,
            //     "dueAmount": 21
            // }

            //check for super admin
            if (req.role != "Super Admin") {
                res.send({
                    code: constant.errorCode,
                    message: "Only super admin allow to do this action",
                });
                return;
            }
            // let hhhhh=data.productsArray[0].QuantityPricing.stringify()

            for (let i = 0; i < data.productsArray.length; i++) {
                if (data.productsArray[i].QuantityPricing) {
                    let jsonArray = JSON.parse(data.productsArray[i].QuantityPricing);
                    data.productsArray[i].QuantityPricing = jsonArray;
                }
            }

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
            let contractArrrayData = [];

            let count = await orderService.getOrdersCount();

            data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
            data.unique_key_search = "GC" + "2024" + data.unique_key_number
            data.unique_key = "GC-" + "2024-" + data.unique_key_number
            if (req.files) {
                const uploadedFiles = req.files.map((file) => ({
                    fileName: file ? file.filename : "",
                    name: file ? file.originalname : "",
                    filePath: file ? file.path : "",
                    size: file ? file.size : "",
                }));

                const filteredProducts = data.productsArray.filter(
                    (product) => product.file !== null
                );
                const filteredProducts2 = data.productsArray.filter(
                    (product) => product.file === null
                );

                const productsWithOrderFiles = filteredProducts.map(
                    (product, index) => {
                        const file = uploadedFiles[index];

                        // Check if 'file' is not null
                        if (file && file.filePath) {
                            return {
                                ...product,
                                file: file.filePath,
                                orderFile: {
                                    fileName: file.fileName,
                                    name: file.name,
                                    size: file.size,
                                },
                            };
                        } else {
                            // If 'file' is null, return the original product without modifications
                            return {
                                ...product,
                                orderFile: {
                                    fileName: "",
                                    name: "",
                                    size: "",
                                },
                            };
                        }
                    }
                );

                const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
                data.productsArray = finalOutput;
            }
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


            // data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
            let savedResponse = await orderService.addOrder(data);
            if (!savedResponse) {
                res.send({
                    code: constant.errorCode,
                    message: "unable to create order",
                });
                return;
            }
            let fileLength = req.files ? req.files.length : 0;
            if (
                fileLength === data.productsArray.length &&
                data.customerId != null &&
                data.paymentStatus == "Paid"
            ) {

                let updateStatus = await orderService.updateOrder(
                    { _id: savedResponse._id },
                    { status: "Active" },
                    { new: true }
                );
                let updateOrder = await orderService.updateOrder(
                    { _id: savedResponse._id },
                    { canProceed: true },
                    { new: true }
                );

                const isValidDate = data.productsArray.every((product) => {
                    const coverageStartDate =
                        product.coverageStartDate != ""
                            ? moment(product.coverageStartDate).format("YYYY-MM-DD")
                            : product.coverageStartDate;
                    return moment(coverageStartDate, "YYYY-MM-DD", true).isValid();
                });



                if (isValidDate) {

                    let contractArrrayData = [];
                    for (let i = 0; i < data.productsArray.length; i++) {
                        let products = data.productsArray[i];
                        let priceBookId = products.priceBookId;
                        let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                        let projection = { isDeleted: 0 };
                        let priceBook = await priceBookService.getPriceBookById(
                            query,
                            projection
                        );
                        const wb = XLSX.readFile(products.file);
                        const sheets = wb.SheetNames;
                        const ws = wb.Sheets[sheets[0]];


                        // let contractCount =
                        //     Number(
                        //         count1.length > 0 && count1[0].unique_key
                        //             ? count1[0].unique_key
                        //             : 0
                        //     ) + 1;

                        const totalDataComing1 = XLSX.utils.sheet_to_json(ws);

                        const totalDataComing = totalDataComing1.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                            };
                        });
                        // let savedDataOrder = savedResponse.toObject()
                        const matchedObject = await savedResponse.productsArray.find(product => product.orderFile.fileName == products.orderFile.fileName);
                        let count1 = await contractService.getContractsCount();
                        totalDataComing.forEach((data, index) => {
                            let unique_key_number1 = count1[0] ? count1[0].unique_key_number + index + 1 : 100000
                            let unique_key_search1 = "OC" + "2024" + unique_key_number1
                            let unique_key1 = "OC-" + "2024-" + unique_key_number1
                            let contractObject = {
                                orderId: savedResponse._id,
                                orderProductId: matchedObject._id,
                                productName: priceBook[0].name,
                                manufacture: data.brand,
                                model: data.model,
                                serial: data.serial,
                                condition: data.condition,
                                productValue: data.retailValue,
                                unique_key: unique_key1,
                                unique_key_number: unique_key_number1,
                                unique_key_search: unique_key_search1,
                            };
                            //console.log("contractObject++++++++++++++++++++contractObject")

                            contractArrrayData.push(contractObject);
                        });



                        // let contractObject = {
                        //     orderId: savedResponse._id,
                        //     orderProductId: matchedObject._id,
                        //     productName: priceBook[0].name,
                        //     manufacture: totalDataComing[0]["brand"],
                        //     model: totalDataComing[0]["model"],
                        //     serial: totalDataComing[0]["serial"],
                        //     condition: totalDataComing[0]["condition"],
                        //     productValue: totalDataComing[0]["retailValue"],
                        //     unique_key: contractCount,
                        // };
                        // contractArrrayData.push(contractObject);
                    }
                    let bulkContracts = await contractService.createBulkContracts(
                        contractArrrayData
                    );
                }
            }
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.processOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action!",
            });
            return;
        }

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
        // .some(Boolean);
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

        const combinedString = returnField.join(', ') + ' is missing';

        // const obj = {
        //     customerId: checkOrder.customerId ? true : 'Customer Name is missing',
        //     paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
        //     coverageStartDate: resultArray.length == 0 ? true : false,
        //     fileName: isEmptyOrderFile.length == 0 ? true : false,
        // };

        // returnField.push(obj);

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

exports.getAllOrders = async (req, res) => {
    try {
        {
            let data = req.body;
            if (req.role != "Super Admin") {
                res.send({
                    code: constant.errorCode,
                    message: "Only super admin allow to do this action",
                });
                return;
            }

            let project = {
                productsArray: 1,
                dealerId: 1,
                unique_key: 1,
                unique_key_number: 1,
                unique_key_search: 1,
                servicerId: 1,
                customerId: 1,
                serviceCoverageType: 1,
                coverageType: 1,
                resellerId: 1,
                paymentStatus: 1,
                status: 1,
                createdAt: 1,
                venderOrder: 1,
                orderAmount: 1,
                contract: "$contract"
            };

            let query = { status: { $ne: "Archieved" } };

            let lookupQuery = [
                {
                    $match: query
                },

                {
                    $lookup: {
                        from: "contracts",
                        localField: "_id",
                        foreignField: "orderId",
                        as: "contract"
                    }
                },
                // {
                //     $project: project,
                // },
                {
                    "$addFields": {
                        "noOfProducts": {
                            "$sum": "$productsArray.checkNumberProducts"
                        },
                        totalOrderAmount: { $sum: "$orderAmount" },
                        // flag: {
                        //     $cond: {
                        //         if: {
                        //             $and: [
                        //                 // { $eq: ["$payment.status", "paid"] },
                        //                 { $ne: ["$productsArray.orderFile.fileName", ''] },
                        //                 { $ne: ["$customerId", null] },
                        //                 { $ne: ["$paymentStatus", 'Paid'] },
                        //                 { $ne: ["$productsArray.coverageStartDate", null] },
                        //             ]
                        //         },
                        //         then: true,
                        //         else: false
                        //     }
                        // }

                    }
                },

                { $sort: { unique_key: -1 } }
            ]



            let ordersResult = await orderService.getOrderWithContract(lookupQuery);
            let dealerIdsArray = ordersResult.map((result) => result.dealerId);
            let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
            let userResellerIds = ordersResult
                .filter(result => result.resellerId !== null)
                .map(result => result.resellerId.toString());

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
                    street: 1
                }
            );
            let customerIdsArray = ordersResult.map((result) => result.customerId);

            let userCustomerIds = ordersResult
                .filter(result => result.customerId !== null)
                .map(result => result.customerId.toString());
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
                        dealerName: {},
                        servicerName: {},
                        customerName: {},
                        resellerName: {},
                    };
                }
            });



            const unique_keyRegex = new RegExp(
                data.unique_key ? data.unique_key.trim() : "",
                "i"
            );
            const venderOrderRegex = new RegExp(
                data.venderOrder ? data.venderOrder.trim() : "",
                "i"
            );
            const status = new RegExp(data.status ? data.status.trim() : "", "i");

            let filteredData = result_Array.filter((entry) => {
                return (
                    unique_keyRegex.test(entry.unique_key) &&
                    venderOrderRegex.test(entry.venderOrder) &&
                    status.test(entry.status)
                );
            });

            const updatedArray = filteredData.map(item => {
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
                // console.log("isEmptyStartDate===================",isEmptyStartDate)
                // console.log("isEmptyOrderFile=====================",isEmptyOrderFile)
                //console.log(hasNullCoverageStartDate)
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
                    servicerName: (item.dealerName.isServicer && item.servicerId != null) ? item.dealerName : (item.resellerName.isServicer && item.servicerId != null) ? item.resellerName : item.servicerName,
                    username: username, // Set username based on the conditional checks
                    resellerUsername: resellerUsername ? resellerUsername : {},
                    customerUserData: customerUserData ? customerUserData : {}
                };
            });


            let orderIdSearch = data.orderId ? data.orderId : ''
            const stringWithoutHyphen = orderIdSearch.replace(/-/g, "")
            const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen : '', 'i')
            const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
            const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
            const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
            const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
            const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
            const statusRegex = new RegExp(data.status ? data.status : '', 'i')

            const filteredData1 = updatedArray.filter(entry => {
                return (
                    venderRegex.test(entry.venderOrder) &&
                    orderIdRegex.test(entry.unique_key_search) &&
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
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getAllArchieveOrders = async (req, res) => {
    let data = req.body;
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action",
        });
        return;
    }

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
    };

    let query = { status: { $eq: "Archieved" } };

    let ordersResult = await orderService.getAllOrders(query, project);
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
                dealerName: dealerName ? dealerName.toObject() : dealerName,
                servicerName: servicerName ? servicerName.toObject() : {},
                customerName: customerName ? customerName.toObject() : {},
                resellerName: resellerName ? resellerName.toObject() : {},
            };
        } else {
            return {
                dealerName: dealerName.toObject(),
                servicerName: servicerName.toObject(),
                customerName: customerName.toObject(),
                resellerName: resellerName.toObject,
            };
        }
    });

    const unique_keyRegex = new RegExp(
        data.unique_key ? data.unique_key.trim() : "",
        "i"
    );
    const venderOrderRegex = new RegExp(
        data.venderOrder ? data.venderOrder.trim() : "",
        "i"
    );
    const status = new RegExp(data.phone ? data.phone.trim() : "", "i");

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
    const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
    const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
    const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
    const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
    const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
    const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
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
            // if(!data.rangeStart||!data.rangeEnd){
            //     res.send({
            //         code:constant.errorCode,
            //         message:"Range start and range end is required"
            //     })
            //     return;
            // }
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

            if (headers.length !== 5) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.successCode,
                    message:
                        "Invalid file format detected. The sheet should contain exactly five columns.",
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
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
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
            // if (parseInt(data.checkNumberProducts) != totalDataComing1.length) {
            //     res.send({
            //         code: constant.errorCode,
            //         message: "Data does not match to the number of orders"
            //     })
            //     return;
            // }
            //    await  fs.unlink(`../../uploads/orderFile/${req.file.filename}`)
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

exports.checkMultipleFileValidation = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body;
            // let data = {
            //     "dealerId": "65aba175107144beb95f3bcf",
            //     "servicerId": "",
            //     "customerId": "",
            //     "resellerId": "",
            //     "productsArray": [
            //         {
            //             "categoryId": "65aba24e182e38ce2ea76f6a",
            //             "priceBookId": "65aba2ad182e38ce2ea76f6b",
            //             "unitPrice": "80.00",
            //             "noOfProducts": 12,
            //             "priceType": "Regular Pricing",
            //             "checkNumberProducts": 45,
            //             "price": 160,
            //             "fileValue": "true",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123",
            //             "orderFile": {
            //                 "fileName": "file-1707291159337.xlsx",
            //                 "name": "file-1707291159337.xlsx"
            //             }

            //         },
            //         {
            //             "categoryId": "65aba24e182e38ce2ea76f6a",
            //             "priceBookId": "65aba2ad182e38ce2ea76f6b",
            //             "unitPrice": "80.00",
            //             "noOfProducts": 12,
            //             "priceType": "Quantity Pricing",
            //             "checkNumberProducts": 45,
            //             "price": 160,
            //             "fileValue": "true",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123"

            //         },
            //         {
            //             "categoryId": "65aba24e182e38ce2ea76f6a",
            //             "priceBookId": "65aba2ad182e38ce2ea76f6b",
            //             "unitPrice": "80.00",
            //             "noOfProducts": 12,
            //             "priceType": "Flat Pricing",
            //             "checkNumberProducts": 45,
            //             "price": 160,
            //             "fileValue": "false",
            //             "manufacture": "Get-Cover123",
            //             "rangeStart": 400,
            //             "rangeEnd": 600,
            //             "model": "Inverter123"

            //         }
            //     ],
            //     "sendNotification": true,
            //     "paymentStatus": "Paid",
            //     "dealerPurchaseOrder": "#12345",
            //     "serviceCoverageType": "Parts",
            //     "coverageType": "Breakdown",
            //     "orderAmount": 144,
            //     "paidAmount": 123,
            //     "dueAmount": 21
            // }

            if (req.files.length > 0) {
                const uploadedFiles = req.files.map((file) => ({
                    filePath: file.destination + '/' + file.filename,
                }));
                let fileIndex = 0;
                const productsWithFiles = data.productsArray.map((data1, index) => {
                    let file1 = undefined; // Initialize file to undefined
                    if (data1.fileValue == 'true') {
                        // Check if data1.file is not blank
                        file1 = uploadedFiles[fileIndex].filePath;
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
                        const wb = XLSX.readFile(productsWithFiles[j].products.file);
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
                            data: XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]),
                        });
                        allHeaders.push({
                            key: productsWithFiles[j].products.key,
                            headers: headers,
                        });
                    }
                }

                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 5)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly five columns.",
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

                        const isValidLength = obj.data.every(
                            (obj1) => Object.keys(obj1).length === 5
                        );
                        if (!isValidLength) {
                            message.push({
                                code: constant.errorCode,
                                key: obj.key,
                                message: "Invalid fields value",
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



                    let serialNumber = allDataComing.map((obj) => {
                        const serialNumberArray = obj.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj.key,
                                serialNumber: item[keys[2]].toString().toLowerCase()
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

                    let checkRetailValue = allDataComing.map((obj) => {
                        if (obj.priceType == "Flat Pricing") {
                            const priceObj = obj.data.map((item) => {
                                const keys = Object.keys(item);
                                return {
                                    key: obj.key,
                                    checkNumberProducts: obj.checkNumberProducts,
                                    noOfProducts: obj.noOfProducts,
                                    rangeStart: obj.rangeStart,
                                    rangeEnd: obj.rangeEnd,
                                    retailValue: item[keys[4]],
                                };
                            });
                            if (priceObj.length > 0) {
                                priceObj.map((obj, index) => {
                                    if (
                                        Number(obj.retailValue) < Number(obj.rangeStart) ||
                                        Number(obj.retailValue) > Number(obj.rangeEnd)
                                    ) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Invalid Retail Price!",
                                        });

                                        return;
                                    }
                                });
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
                if (data.productsArray[i].orderFile.fileName != '') {
                    let fileName = process.env.LOCAL_FILE_PATH + "/" + data.productsArray[i].orderFile.fileName
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
                        const wb = XLSX.readFile(productsWithFiles[j].file);
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
                            data: XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]),
                        });
                        allHeaders.push({
                            key: productsWithFiles[j].key,
                            headers: headers,
                        });
                    }
                }

                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 5)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly five columns.",
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

                        const isValidLength = obj.data.every(
                            (obj1) => Object.keys(obj1).length === 5
                        );
                        if (!isValidLength) {
                            message.push({
                                code: constant.errorCode,
                                key: obj.key,
                                message: "Invalid fields value",
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

                    let checkRetailValue = allDataComing.map((obj) => {
                        if (obj.priceType == "Flat Pricing") {
                            const priceObj = obj.data.map((item) => {
                                const keys = Object.keys(item);
                                return {
                                    key: obj.key,
                                    checkNumberProducts: obj.checkNumberProducts,
                                    noOfProducts: obj.noOfProducts,
                                    rangeStart: obj.rangeStart,
                                    rangeEnd: obj.rangeEnd,
                                    retailValue: item[keys[4]],
                                };
                            });

                            if (priceObj.length > 0) {
                                priceObj.map((obj, index) => {
                                    if (
                                        Number(obj.retailValue) < Number(obj.rangeStart) ||
                                        Number(obj.retailValue) > Number(obj.rangeEnd)
                                    ) {
                                        message.push({
                                            code: constant.errorCode,
                                            retailPrice: obj.retailValue,
                                            key: obj.key,
                                            message: "Invalid Retail Price!",
                                        });
                                    }
                                });
                            }
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
                message: 'Success!'
            })
        }
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}


exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        if (data.resellerId != "") {
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

        res.send({
            code: constant.successCode,
            message: "Successfully Fetched",
            result: getCustomers,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

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
        // if (!getServicersIds) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Unable to fetch the servicer"
        //     })
        //     return;
        // }
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
        // if (!checkReseller) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Invalid Reseller ID"
        //     })
        //     return;
        // }
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
            return servicer.toObject();
        }
    });

    res.send({
        code: constant.successCode,
        result: result_Array,
    });
};

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
        // price book ids array from dealer price book
        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
        let query = { _id: { $in: dealerPriceIds } };
        // if(data.priceCatId){
        //     let categories =
        //     query = { _id: { $in: dealerPriceIds } ,}
        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {});

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

            // dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: req.params.dealerId, priceBook: data.priceBookId })
        }

        let result = {
            priceCategories: getCategories,
            priceBooks: mergedPriceBooks,
            selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
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
            message: err.message,
        });
    }
};

exports.checkPurchaseOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action",
            });
            return;
        }
        let checkPurchaseOrder;
        let data = req.body;
        if (
            data.oldDealerPurchaseOrder != "" &&
            data.oldDealerPurchaseOrder != data.dealerPurchaseOrder
        ) {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId,
                },
                { isDeleted: 0 }
            );
        } else if (data.oldDealerPurchaseOrder == "") {
            checkPurchaseOrder = await orderService.getOrder(
                {
                    venderOrder: req.body.dealerPurchaseOrder,
                    dealerId: req.body.dealerId,
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

exports.archiveOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action",
            });
            return;
        }

        let checkOrder = await orderService.getOrder(
            { _id: req.params.orderId },
            { isDeleted: 0 }
        );
        if (!checkOrder) {
            res.send({
                code: constant.successCode,
                message: "Order not found!",
            });

            return;
        }

        let updateStatus = await orderService.updateOrder(
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

        res.send({
            code: constant.successCode,
            message: "Success!",
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });

        return;
    }
};

exports.getSingleOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action",
            });
            return;
        }
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
                // { resellerId: checkOrder.resellerId },
                // { dealerId: checkOrder.dealerId },
            ],
        };
        let checkServicer = await servicerService.getServiceProviderById(query1);
        let userData = {
            dealerData: dealer ? dealer : {},
            customerData: customer ? customer : {},
            resellerData: reseller ? reseller : {},
            servicerData: checkServicer ? checkServicer : {}
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
            message: err.message,
        });
    }
};

exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        // let data = {
        //     "_id": "65c5f9b57e935a6b4aa10cf9",
        //     "dealerId": "65c49fa82e3394537511528e",
        //     "servicerId": "65c4f445023c5e533fefc6d0",
        //     "customerId": "65c4a2755b49fb821a5aa3b2",
        //     "resellerId": "65c4a1132e3394537511529f",
        //     "venderOrder": "NIk-001",
        //     "serviceCoverageType": "Parts & Labour",
        //     "coverageType": "Breakdown & Accidental",
        //     "unique_key_number": 100000,
        //     "unique_key_search": "GC2024100000",
        //     "unique_key": "GC-2024-100000",
        //     "productsArray": [
        //         {
        //             "categoryId": "65c32a947e54710b7783fdb9",
        //             "priceBookId": "65c32c097e54710b7783fdc1",
        //             "unitPrice": 500,
        //             "noOfProducts": 1,
        //             "priceType": "Quantity Pricing",
        //             "term": 12,
        //             "description": "testing",
        //             "checkNumberProducts": 56,
        //             "orderFile": {
        //                 "fileName": "file-1707473332788.xlsx",
        //                 "name": "Copy of Copy of Add Product Format.xlsx",
        //                 "size": "5987",
        //                 "_id": "65c5f9b57e935a6b4aa10cfc"
        //             },
        //             "QuantityPricing": [
        //                 {
        //                     "name": "panel",
        //                     "quantity": 20,
        //                     "enterQuantity": 15,
        //                     "_id": "65c32c097e54710b7783fdc2"
        //                 },
        //                 {
        //                     "name": "inverter",
        //                     "quantity": 40,
        //                     "enterQuantity": 40,
        //                     "_id": "65c32c097e54710b7783fdc3"
        //                 },
        //                 {
        //                     "name": "battery",
        //                     "quantity": 1,
        //                     "enterQuantity": 1,
        //                     "_id": "65c32c097e54710b7783fdc4"
        //                 }
        //             ],
        //             "price": 500,
        //             "additionalNotes": "",
        //             "rangeStart": null,
        //             "rangeEnd": null,
        //             "coverageStartDate": "2024-02-29T00:00:00.000Z",
        //             "coverageEndDate": "2025-02-28T00:00:00.000Z",
        //             "_id": "65c5f9b57e935a6b4aa10cfb"
        //         }
        //     ],
        //     "orderAmount": 500,
        //     "sendNotification": true,
        //     "paymentStatus": "Paid",
        //     "status": "Active",
        //     "isDeleted": false,
        //     "orderDate": "2024-02-09T10:06:50.134Z",
        //     "paidAmount": 500,
        //     "dueAmount": 0,
        //     "paymentMethod": "Manually",
        //     "canProceed": true,
        //     "createdAt": "2024-02-09T10:08:53.779Z",
        //     "updatedAt": "2024-02-09T10:08:54.248Z",
        //     "__v": 0
        // }

        let checkId = await orderService.getOrder({ _id: req.params.orderId });
        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid order ID",
            });
            return;
        }


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

        if (data.servicerId != checkId.servicerId) {
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

        if (data.customerId != checkId.customerId) {
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

        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;

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
        // if(checkId.venderOrder != data.dealerPurchaseOrder){
        //     let checkVenderOrder = await orderService.getOrder({ venderOrder: data.dealerPurchaseOrder, dealerId: data.dealerId }, {})
        // if (checkVenderOrder) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "dealer purchase order is already exist"
        //     })
        //     return;
        // }
        // }

        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            data,
            { new: true }
        );
        if (!savedResponse) {
            res.send({
                code: constant.errorCode,
                message: "unable to create order",
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


        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let savedResponse = await orderService.updateOrder(
                { _id: req.params.orderId },
                { status: "Active" },
                { new: true }
            );
            let contractArray = [];
            await savedResponse.productsArray.map(async (product) => {
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                let priceBookId = product.priceBookId;
                let orderProductId = product._id;
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                let projection = { isDeleted: 0 };
                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                const wb = XLSX.readFile(pathFile);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
                let count1 = await contractService.getContractsCount();
                let contractCount =
                    Number(
                        count1.length > 0 && count1[0].unique_key
                            ? count1[0].unique_key
                            : 0
                    ) + 1;

                const totalDataComing1 = XLSX.utils.sheet_to_json(ws);
                const totalDataComing = totalDataComing1.map((item) => {
                    const keys = Object.keys(item);
                    return {
                        brand: item[keys[0]],
                        model: item[keys[1]],
                        serial: item[keys[2]],
                        condition: item[keys[3]],
                        retailValue: item[keys[4]],
                    };
                });
                // let savedDataOrder = savedResponse.toObject()

                totalDataComing.forEach((data, index) => {
                    let unique_key_number1 = count1[0] ? count1[0].unique_key_number + index + 1 : 100000
                    let unique_key_search1 = "OC" + "2024" + unique_key_number1
                    let unique_key1 = "OC-" + "2024-" + unique_key_number1
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        manufacture: data.brand,
                        model: data.model,
                        serial: data.serial,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };
                    contractArray.push(contractObject);
                    //let saveData = contractService.createContract(contractObject)
                });

                await contractService.createBulkContracts(contractArray);

            })

            res.send({
                code: constant.successCode,
                message: "Success",
            });
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        }


        // if (data.priceBookId!=checkId.) {
        //     let query = { _id: data.priceBookId }
        //     let checkPriceBook = await priceBookService.findByName1(query)
        //     if (!checkPriceBook) {
        //         res.send({
        //             code: constant.errorCode,
        //             message: "PriceBook not found"
        //         })
        //         return;
        //     }
        // }

        // let data = req.body
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.markAsPaid = async (req, res) => {
    try {
        let data = req.body
        let updateOrder = await orderService.updateOrder({ _id: req.params.orderId }, { paymentStatus: "Paid", status: "Active" }, { new: true })
        if (!updateOrder) {
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
        let contracts = [];


        await savedResponse.productsArray.map(async (product) => {
            const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName

            let priceBookId = product.priceBookId;
            let orderProductId = product._id;
            let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
            let projection = { isDeleted: 0 };
            let priceBook = await priceBookService.getPriceBookById(
                query,
                projection
            );
            const wb = XLSX.readFile(pathFile);
            const sheets = wb.SheetNames;
            const ws = wb.Sheets[sheets[0]];
            let count1 = await contractService.getContractsCount();

            // let contractCount =
            //     Number(
            //         count1.length > 0 && count1[0].unique_key
            //             ? count1[0].unique_key
            //             : 0
            //     ) + 1;

            const totalDataComing1 = XLSX.utils.sheet_to_json(ws);
            const totalDataComing = totalDataComing1.map((item) => {
                const keys = Object.keys(item);
                return {
                    brand: item[keys[0]],
                    model: item[keys[1]],
                    serial: item[keys[2]],
                    condition: item[keys[3]],
                    retailValue: item[keys[4]],
                };
            });
            // let savedDataOrder = savedResponse.toObject()
            totalDataComing.forEach((data, index) => {
                let unique_key_number1 = count1[0] ? count1[0].unique_key_number + index + 1 : 100000
                let unique_key_search1 = "OC" + "2024" + unique_key_number1
                let unique_key1 = "OC-" + "2024-" + unique_key_number1
                let contractObject = {
                    orderId: savedResponse._id,
                    orderProductId: orderProductId,
                    productName: priceBook[0].name,
                    manufacture: data.brand,
                    model: data.model,
                    serial: data.serial,
                    condition: data.condition,
                    productValue: data.retailValue,
                    unique_key: unique_key1,
                    unique_key_search: unique_key_search1,
                    unique_key_number: unique_key_number1,
                };
                // console.log("contractObject===========================")

                contracts.push(contractObject);
            });

            // console.log("contracts===========================", contracts)
            let saveData = await contractService.createBulkContracts(contracts)
        })

        res.send({
            code: constant.successCode,
            message: "Updated Successfully"
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

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
        let checkOrders = await orderService.getDashboardData(query, project)
        if (!checkOrders[0]) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch order data"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            result: checkOrders[0]
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getOrderContract = async (req, res) => {
    try {
        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
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
            {
                $addFields: {
                    contracts: {
                        $slice: ["$contracts", skipLimit, limitData] // Replace skipValue and limitValue with your desired values
                    }
                }
            }
            // { $unwind: "$contracts" }
        ]

        let checkOrder = await contractService.getContracts(query, skipLimit, limitData)
        let totalContract = await contractService.findContracts({ orderId: new mongoose.Types.ObjectId(req.params.orderId) }, skipLimit, pageLimit)
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

        const queryDealerUser = { accountId: { $in: [checkOrder[0].order[0] ? checkOrder[0].order[0].dealerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

        const queryResselerUser = { accountId: { $in: [checkOrder[0].order[0] ? checkOrder[0].order[0].resellerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

        let dealerUser = await userService.findUserforCustomer(queryDealerUser)

        let resellerUser = await userService.findUserforCustomer(queryResselerUser)

        //Get Servicer Data

        let query1 = {
            $or: [
                { _id: checkOrder[0].order[0].servicerId ? checkOrder[0].order[0].servicerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
                // { resellerId: checkOrder[0].order[0].resellerId ? checkOrder[0].order[0].resellerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
                // { dealerId: checkOrder[0].order[0].dealerId ? checkOrder[0].order[0].dealerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
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
            contractCount: totalContract.length,
            orderUserData: userData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.generatePDF = async (req, res) => {
    try {
        let query = [
            {
                $match: { _id: new mongoose.Types.ObjectId(req.params.orderId) }
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "_id",
                    foreignField: "orderId",
                    as: "contracts"
                }
            },
            {
                "$lookup": {
                    "from": "pricecategories",
                    "localField": "productsArray.categoryId",
                    "foreignField": "_id",
                    "as": "category"
                }
            },
            {
                $addFields: {
                    "productsArray.category": { $arrayElemAt: ["$category", 0] },
                }
            },
            {
                $lookup: {
                    from: "dealers",
                    localField: "dealerId",
                    foreignField: "_id",
                    as: "dealers",

                }
            },
            {
                $lookup: {
                    from: "serviceproviders",
                    localField: "servicerId",
                    foreignField: "_id",
                    as: "servicer"
                }
            },
            {
                $lookup: {
                    from: "resellers",
                    localField: "resellerId",
                    foreignField: "_id",
                    as: "resellers"
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
                $unwind: "$dealers" // Unwind dealers array
            },
            {
                $lookup: {
                    from: "users", // users collection
                    let: { accountIdStr: { $toString: "$dealers._id" } }, // Convert accountId to string
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$accountId", "$$accountIdStr"] } // Match _id in users with accountId converted to string
                            }
                        }
                    ],
                    as: "dealerUsers" // Alias for the result
                }
            },
            {
                $unwind: "$dealerUsers" // Unwind dealers array
            },
            {
                $unwind: "$resellers" // Unwind dealers array
            },
            {
                $lookup: {
                    from: "users", // users collection
                    let: { accountIdStr: { $toString: "$resellers._id" } }, // Convert accountId to string
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$accountId", "$$accountIdStr"] } // Match _id in users with accountId converted to string
                            }
                        }
                    ],
                    as: "resellerUsers" // Alias for the result
                }
            },
            {
                $unwind: "$resellerUsers" // Unwind dealers array
            },


        ];

        let orderWithContracts = await orderService.getOrderWithContract(query);

        let productsData = []

        for (let i = 0; i < orderWithContracts[0].productsArray.length; i++) {
            const productId = orderWithContracts[0].productsArray[i]._id;
            const contract = await contractService.findContracts({ orderProductId: productId });
            const mergedObject = { ...orderWithContracts[0].productsArray[i], contract }
            productsData.push(mergedObject)
        }
        orderWithContracts[0].productsArray = productsData
        //    let okokok =   orderWithContracts[0].productsArray.map(async (product) => {
        //         const productId = product._id;
        //         const contract = await contractService.findContracts({ orderProductId: productId });
        //         const mergedObject = { ...product, contract }

        //     })
        //     orderWithContracts[0].productsArray = okokok
        // orderWithContracts[0].productsArray.forEach(async(product) => {
        //   const productId = product._id;
        //   const contract = await contractService.findContracts({orderProductId :productId});

        //   if (contract) {
        //     // Merge product and contract
        //     const mergedObject = { ...product, contract };

        //     // Do something with merged object
        //     orderWithContracts[0].productsArray.push(mergedObject)

        //   } 
        // });

        let htmlContent;

        if (orderWithContracts.length > 0) {
            htmlContent = `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tbody>
                <tr>
                    <td style="text-align: left; width: 50%;">
                        <img src='http://15.207.221.207/static/media/logo.642c96aed42bd8a1d454.png' style="margin-bottom: 20px;"/>
                        <h1 style="margin: 0; padding: 0; font-size:20px"><b>Get Cover </b></h1>
                        <p style="margin: 0; padding: 0;">13th Street <br/>
                        47 W 13th St, New York,<br/>
                        NY 10011, USA</p>
                    </td>
                    <td style=" width: 50%;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <td colspan="2" style="text-align: right; padding-right: 20px; padding-bottom: 40px;"><b style="margin: 0; padding-bottom: 40px; font-size:30px;">Export Order</b></td>
                                </tr>
                                <tr>
                                    <td><b> Order ID : </b></td> 
                                    <td>${orderWithContracts[0].unique_key}</td>
                                </tr>
                                <tr>
                                    <td><b> Dealer P.O. # : </b></td> 
                                    <td>${orderWithContracts[0].venderOrder}</td>
                                </tr>
                                <tr>
                                    <td><b>Service Coverage : </b></td>
                                    <td>${orderWithContracts[0].serviceCoverageType}</td>
                                </tr>
                                <tr>
                                    <td><b> Coverage Type : </b></td>
                                    <td>${orderWithContracts[0].coverageType}</td>
                                </tr>
                            </thead>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tbody>
                <tr>
                    <td style="text-align: left; width: 50%;">
                        <h4 style="margin: 0; padding: 0;"><b>Dealer Details: </b></h4>
                        <h4 style="margin: 0; padding: 0;"><b>${orderWithContracts[0].dealers ? orderWithContracts[0].dealers.name : ''}</b></h4>
                        <small style="margin: 0; padding: 0;">Bill To: ${orderWithContracts[0].dealerUsers ? orderWithContracts[0].dealerUsers.firstName + " " + orderWithContracts[0].dealerUsers.lastName : ''} <br/>
                        ${orderWithContracts[0].dealers ? orderWithContracts[0].dealers.street : ''},
                        ${orderWithContracts[0].dealers ? orderWithContracts[0].dealers.city : ''},
                        ${orderWithContracts[0].dealers ? orderWithContracts[0].dealers.state : ''},
                        ${orderWithContracts[0].dealers ? orderWithContracts[0].dealers.zip : ''}<br/>
                        ${orderWithContracts[0].dealerUsers ? orderWithContracts[0].dealerUsers.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''} | ${orderWithContracts[0].dealerUsers ? orderWithContracts[0].dealerUsers.email : ''}</small>
                    </td>
                    <td style="text-align: left; width: 50%;">
                        ${orderWithContracts[0].resellers ? (`<h4 style="margin: 0; padding: 0;"><b>Reseller Details:</b></h4>
                        <h4 style="margin: 0; padding: 0;"><b>${orderWithContracts[0].resellers ? orderWithContracts[0].resellers.name : ''}</b></h4>
                        <small style="margin: 0; padding: 0;">Bill To: ${orderWithContracts[0].resellerUsers ? orderWithContracts[0].resellerUsers.firstName + " " + orderWithContracts[0].resellerUsers.lastName : ''} <br/>
                        ${orderWithContracts[0].resellers ? orderWithContracts[0].resellers.street : ''}
                        ${orderWithContracts[0].resellers ? orderWithContracts[0].resellers.city : ''}
                        ${orderWithContracts[0].resellers ? orderWithContracts[0].resellers.state : ''}
                        ${orderWithContracts[0].resellers ? orderWithContracts[0].resellers.zip : ''}<br/>
                        ${orderWithContracts[0].resellerUsers ? orderWithContracts[0].resellerUsers.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''} | ${orderWithContracts[0].resellerUsers ? orderWithContracts[0].resellerUsers.email : ''}</small>`) : ''}
                    </td>
                </tr>
            </tbody>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tbody>
                <tr>
                    <td style="text-align: left; margin-top:40px; width: 50%;">
                        ${orderWithContracts[0].customers?.length > 0 ? (`<h4 style="margin: 0; padding: 0;"><b>Customer Details: </b></h4>
                        <h4 style="margin: 0; padding: 0;"><b>${orderWithContracts[0].customers.length > 0 ? orderWithContracts[0].customers[0].username : ''}</b></h4>
                        <small style="margin: 0; padding: 0;">${orderWithContracts[0].customers.length > 0 ? orderWithContracts[0].customers[0].street : ''}
                        ${orderWithContracts[0].customers.length > 0 ? orderWithContracts[0].customers[0].city : ''}
                        ${orderWithContracts[0].customers.length > 0 ? orderWithContracts[0].customers[0].state : ''}
                        ${orderWithContracts[0].customers.length > 0 ? orderWithContracts[0].customers[0].zip : ''}<br/>
                        </small>`) : ''}
                    </td>
                    <td style="text-align: left; width: 50%;">
                        ${orderWithContracts[0].servicer?.length > 0 ? (`
                        <h4 style="margin: 0; padding: 0;"><b>Servicer Details:</b></h4>
                        <h4 style="margin: 0; padding: 0;"><b>${orderWithContracts[0].servicer.length > 0 ? orderWithContracts[0].servicer[0].name : ''}</b></h4>
                        <small style="margin: 0; padding: 0;">${orderWithContracts[0].servicer.length > 0 ? orderWithContracts[0].servicer[0].street : ''}
                        ${orderWithContracts[0].servicer.length > 0 ? orderWithContracts[0].servicer[0].city : ''}
                        ${orderWithContracts[0].servicer.length > 0 ? orderWithContracts[0].servicer[0].state : ''}
                        ${orderWithContracts[0].servicer.length > 0 ? orderWithContracts[0].servicer[0].zip : ''}<br/>
                        </small>`) : ''}
                    </td>
                </tr>
            </tbody>
        </table>`
            for (let i = 0; i < orderWithContracts.length; i++) { // Iterate through each order
                const order = orderWithContracts[i];
                for (let j = 0; j < order.productsArray.length; j++) { // Iterate through each product in the order
                    const product = order.productsArray[j];
                    const pageSize = 20; // Number of contracts per page
                    const contracts = product.contract;
                    // Retrieve order contracts for the current product
                    htmlContent += `<table style="width: 100%; border-collapse: collapse; margin-bottom:5px">
                    <tbody>
                        <tr style='padding-bottom:5px;'>
                            <td><b style="font-size:20px">${j + 1}. Product Details:</b></td>
                        </tr>
                    </tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f4f4f4; margin-top:0px">
                    <tbody style="text-align: left;">
                        <tr>
                            <td><b>Product Category:</b> ${product.category.name}</td>
                            <td><b>Product Name:</b> ${product.description}</td>
                        </tr>
                    </tbody>
                </table>
                <table style=""> 
                    <tbody>
                        <tr>
                            <td><b>Product Description:</b> ${product.description}</td>
                        </tr>
                    </tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom:40px">
                    <tbody style="text-align: left;">
                        <tr>
                            <td><b>Term:</b> ${product.term} Month</td>
                            <td><b>Unit Price:</b>  ${product.unitPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                            <td><b># of Products:</b> ${product.noOfProducts}.00</td>
                        </tr>
                        <tr>
                            <td><b>Price:</b> ${product.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                            <td><b>Coverage Start Date:</b> ${new Date(product.coverageStartDate).toLocaleDateString()}</td>
                            <td><b>Coverage End Date:</b> ${new Date(product.coverageEndDate).toLocaleDateString()}</td>
                        </tr>
                    </tbody>
                </table>`
                    let startIndex = 0
                    let endIndex = 6
                    let serialNo = 0
                    var pageCount = Math.ceil(contracts.length / pageSize);
                    for (let page = 0; page < pageCount; page++) {

                        // Start of a new page
                        htmlContent += `
                  <table style="page-break-before: ${page === 0 ? 'auto' : 'always'}; width: 100%; border-collapse: collapse;">
                      <thead style="background-color: #f4f4f4; text-align: left;">
                          <tr>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">S.no.</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Brand</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Model</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Serial</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Retail Price</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Condition</th>
                              <th style="border-bottom: 1px solid #ddd; padding: 8px;">Claimed Value</th>
                          </tr>
                      </thead>
                      <tbody>
                      ${( startIndex == 0 ) || (endIndex - startIndex > 19) ?
                        contracts
                                ?.slice(startIndex, endIndex)
                                ?.map(
                                    (contract, index) => `
                                <tr>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${index + 1}</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.manufacture}</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.manufacture}</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.serial}</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.productValue}.00</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.condition}</td>
                                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">$ ${parseInt(contract.claimAmount).toFixed(2)}</td>
                                </tr>
                            `
                                ):(
                                    ''
                                )
                               }
                    `;
                    startIndex = endIndex;
                    endIndex = Math.min(endIndex + 20, contracts.length);
                        if (startIndex !== 0 && endIndex !== 6 && endIndex - startIndex < 20) {
                            {
                                for (let i = startIndex; i < endIndex; i++) {
                                    const contract = contracts[i];
                                    htmlContent += `
                                    <tr>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${(i-startIndex) + 1}</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.manufacture}</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.manufacture}</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.serial}</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.productValue}.00</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">${contract.condition}</td>
                                        <td style="border-bottom: 1px solid #ddd; padding: 8px;">$ ${parseInt(contract.claimAmount).toFixed(2)}</td>
                                    </tr>
                                `;
                                }

                                htmlContent += `</tbody></table>`
                            }

                            // if(endIndex > contracts.length){
                            //     endIndex = contracts.length 
                            //     pageCount = pageCount + 1
                            // }

                        }
                       
                    }
                }
            }
        }


        res.send({
            code: constant.successCode,
            result: htmlContent,
            orderWithContracts: orderWithContracts
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            line: err.stack,
            message: err.message
        })
    }
}