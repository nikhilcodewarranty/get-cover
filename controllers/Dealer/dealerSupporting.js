require('dotenv').config()
const USER = require('../../models/User/users')
const dealerService = require("../../services/Dealer/dealerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const claimService = require("../../services/Claim/claimService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerRelation = require("../../models/Provider/dealerServicer");
const servicerService = require("../../services/Provider/providerService");
const userService = require("../../services/User/userService");
const role = require("../../models/User/role");
const dealer = require("../../models/Dealer/dealer");
const constant = require('../../config/constant');
const LOG = require('../../models/User/logs')
const resellerService = require('../../services/Dealer/resellerService');
const orderService = require('../../services/Order/orderService');
const order = require('../../models/Order/order');
const contractService = require('../../services/Contract/contractService');
const logs = require('../../models/User/logs');
const supportingFunction = require('../../config/supportingFunction');
const providerService = require('../../services/Provider/providerService');
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
const csvParser = require('csv-parser');
const { isBoolean } = require('util');
const { string } = require('joi');
const { constants } = require('buffer');


// All Dealer Books
exports.getAllDealerPriceBooks = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let projection = { isDeleted: 0, __v: 0 }
        let query = { isDeleted: false }
        let getDealerPrice = await dealerPriceService.getAllDealerPrice(query, projection)
        if (!getDealerPrice) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the dealer price books"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: getDealerPrice
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get servicer list
exports.getServicersList = async (req, res) => {
    try {
        let data = req.body
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action!"
            })
            return;
        }
        let query = { isDeleted: false, accountStatus: "Approved", status: true, dealerId: null, resellerId: null }
        let projection = { __v: 0, isDeleted: 0 }
        let servicer = await servicerService.getAllServiceProvider(query, projection);
        const dealerReseller = await resellerService.getResellers({ dealerId: req.params.dealerId, status: true });
        let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })
        const resultArray = servicer.map(item => {
            let documentData = {}
            const matchingServicer = getRelations.find(servicer => servicer.servicerId?.toString() == item._id?.toString() || servicer.servicerId?.toString() == item.resellerId?.toString());
            documentData = item._doc
            return { ...documentData, check: !!matchingServicer };
        });

        let filteredData = resultArray.filter(item => item !== undefined);

        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get reseller servicer
exports.getDealerResellers = async (req, res) => {
    try {
        let data = req.body
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let checkDealer = await dealerService.getDealerById(req.params.dealerId, {})

        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.params.dealerId }
        let projection = { __v: 0 }
        const resellers = await resellerService.getResellers(query, projection);
        if (!resellers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the resellers"
            });
            return;
        };
        const resellerId = resellers.map(obj => obj._id);
        const orderResellerId = resellers.map(obj => obj._id);
        const queryUser = { metaId: { $in: resellerId }, isPrimary: true };
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
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.metaId)

            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orderData: order ? order : {}
                };
            } else {
                return dealerData.toObject();
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
}

//Get deaer orders
exports.getDealerOrders = async (req, res) => {
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

            let query = { status: { $ne: "Archieved" }, dealerId: new mongoose.Types.ObjectId(req.params.dealerId) };
            let lookupQuery = [
                {
                    $match: query
                },
                {
                    $project: project,
                },
                {
                    "$addFields": {
                        "noOfProducts": {
                            "$sum": "$productsArray.checkNumberProducts"
                        },
                        totalOrderAmount: { $sum: "$orderAmount" },
                        flag: {
                            $cond: {
                                if: {
                                    $and: [
                                        // { $eq: ["$payment.status", "paid"] },
                                        { $ne: ["$productsArray.orderFile.fileName", ''] },
                                        { $ne: ["$customerId", null] },
                                        { $ne: ["$paymentStatus", 'Paid'] },
                                        { $ne: ["$productsArray.coverageStartDate", null] },
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        }
                    }
                },
                { $sort: { unique_key: -1 } }
            ]

            let pageLimit = data.pageLimit ? Number(data.pageLimit) : 1000000
            let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
            let limitData = Number(pageLimit)
            let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, 100000);
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
                    street: 1
                }
            );
            let customerIdsArray = ordersResult.map((result) => result.customerId);
            const customerCreteria = { _id: { $in: customerIdsArray } };
            let userCustomerIds = ordersResult
                .filter(result => result.customerId !== null)
                .map(result => result.customerId);
            const allUserIds = mergedArray.concat(userCustomerIds);
            const queryUser = { metaId: { $in: allUserIds }, isPrimary: true };
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
                                item2.resellerId === item1.servicerId
                        )
                        : null;
                const customerName =
                    item1.customerId != null
                        ? respectiveCustomer.find(
                            (item2) => item2._id.toString() === item1.customerId?.toString()
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
                        resellerName: resellerName.toObject(),
                    };
                }
            });

            const unique_keyRegex = new RegExp(
                data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : "",
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

            const updatedArray = filteredData.map(item => {
                let username = null; // Initialize username as null
                let resellerUsername = null
                let customerUserData = null
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

                if (item.dealerName) {
                    username = getPrimaryUser.find(user => user.metaId.toString() === item.dealerName._id.toString());
                }

                if (item.resellerName) {
                    resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.metaId.toString() === item.resellerName._id.toString()) : {};
                }

                if (item.customerName) {
                    customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.metaId.toString() === item.customerName._id.toString()) : {};
                }

                return {
                    ...item,
                    servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
                    username: username, // Set username based on the conditional checks
                    resellerUsername: resellerUsername ? resellerUsername : {},
                    customerUserData: customerUserData ? customerUserData : {}
                };
            });
            let orderIdSearch = data.orderId ? data.orderId : ''
            const stringWithoutHyphen = orderIdSearch.replace(/-/g, "")
            const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen.replace(/\s+/g, ' ').trim() : '', 'i')
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
                    customerNameRegex.test(entry.customerName.name) &&
                    resellerNameRegex.test(entry.resellerName.name) &&
                    statusRegex.test(entry.status)
                );
            });
            res.send({
                code: constant.successCode,
                message: "Success",
                result: filteredData1,
                "totalCount": updatedArray.length
            });
        };
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get dealer contract
exports.getDealerContract = async (req, res) => {
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
        let orderAndCondition = []
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })
        }
        if (resellerIds.length > 0) {
            orderAndCondition.push({ resellerId: { $in: resellerIds } })
        }

        if (customerIds.length > 0) {
            orderAndCondition.push({ customerId: { $in: customerIds } })
        }

        if (req.params.dealerId) {
            userSearchCheck = 1
            orderAndCondition.push({ dealerId: { $in: [req.params.dealerId] } })
        };

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
                                    manufacture: 1,
                                    productValue: 1,
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
                                minDate: 1,
                                productValue: 1,
                                status: 1,
                                manufacture: 1,
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
        let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0
        let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
        for (let e = 0; e < result1.length; e++) {
            result1[e].reason = " "
            if (result1[e].status != "Active") {
                result1[e].reason = "Contract is not active"
            }
            // if (result1[e].minDate < new Date()) {
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

        res.send({
            code: constant.successCode,
            message: "Success",
            result: result1,
            totalCount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get dealer claim
exports.getDealerClaims = async (req, res) => {
    try {
        if (req.role != 'Super Admin') {
            res.send({
                code: constant.errorCode,
                message: 'Only super admin allow to do this action'
            });
            return;
        }
        let data = req.body
        let query = { isDeleted: false };
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        const checkDealer = await dealerService.getDealerById(req.params.dealerId);
        let servicerMatch = {}
        if (data.servicerName != '' && data.servicerName != undefined) {
            const checkServicer = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
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
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: 'Dealer not found!'
            });
            return
        }

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
                        $lookup: {
                            from: "serviceproviders",
                            localField: "contracts.orders.servicerId",
                            foreignField: "_id",
                            as: "contracts.orders.servicers",
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
                            claimType: 1,
                            totalAmount: 1,
                            servicerId: 1,
                            customerStatus: 1,
                            trackingNumber: 1,
                            trackingType: 1,
                            repairParts: 1,
                            diagnosis: 1,
                            claimStatus: 1,
                            repairStatus: 1,
                            "contracts.unique_key": 1,
                            "contracts.productName": 1,
                            "contracts.pName": 1,
                            "contracts.model": 1,
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
                                        "isServicer": "$$reseller.isServicer"
                                    }
                                }
                            }
                        }
                    },

                ]
            }
        })
        let lookupQuery = [
            { $sort: { unique_key_number: -1 } },
            {
                $match:
                {
                    $and: [
                        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        claimPaidStatus,
                        { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
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
        allServicer = await servicerService.getAllServiceProvider(
            { _id: { $in: allServicerIds }, status: true },
            {}
        );
        const result_Array = resultFiter.map((item1) => {
            servicer = []
            let servicerName = '';
            let selfServicer = false;
            let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
                const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
                servicer.push(dealerOfServicer)
            });
            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }
            if (item1.contracts.orders.resellers[0]?.isServicer) {
                servicer.unshift(item1.contracts.orders.resellers[0])
            }
            if (item1.contracts.orders.dealers.isServicer) {
                servicer.unshift(item1.contracts.orders.dealers)
            }
            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer._id?.toString() === item1.servicerId?.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false
            }
            return {
                ...item1,
                servicerData: servicerName,
                selfServicer: selfServicer,
                contracts: {
                    ...item1.contracts,
                    allServicer: servicer
                }
            }
        })
        let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
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

//Get dealer servicer
exports.getDealerServicers = async (req, res) => {
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
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }
        let ids = getServicersIds.map((item) => item.servicerId)
        let servicer = await servicerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        // Get Dealer Reseller Servicer

        let dealerResellerServicer = await resellerService.getResellers({ dealerId: req.params.dealerId, isServicer: true })

        if (dealerResellerServicer.length > 0) {
            servicer.unshift(...dealerResellerServicer);
        }

        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        };
        const servicerIds = servicer.map(obj => obj._id);
        const query1 = { metaId: { $in: servicerIds }, isPrimary: true };
        let servicerUser = await userService.getMembers(query1, {});
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };
        // Get servicer with claim
        const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: "Completed" };

        const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "Completed" };
        let claimAggregateQuery1 = [
            {
                $match: servicerCompleted
            },
            {
                "$group": {
                    "_id": "$servicerId",
                    "totalAmount": {
                        "$sum": {
                            "$sum": "$totalAmount"
                        }
                    },
                },

            },
        ]

        let valueClaim = await claimService.getClaimWithAggregate(claimAggregateQuery1);
        let claimAggregateQuery = [
            {
                $match: servicerClaimsIds
            },
            {
                $group: {
                    _id: "$servicerId",
                    noOfOrders: { $sum: 1 },
                }
            },
        ]
        let numberOfClaims = await claimService.getClaimWithAggregate(claimAggregateQuery)

        const result_Array = servicer.map(item1 => {
            const matchingItem = servicerUser.find(item2 => item2.metaId?.toString() === item1?._id.toString());
            const claimValue = valueClaim.find(claim => claim._id?.toString() === item1._id?.toString())
            const claimNumber = numberOfClaims.find(claim => claim._id?.toString() === item1._id?.toString())

            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: item1.toObject(),
                    claimNumber: claimNumber ? claimNumber : 0,
                    claimValue: claimValue ? claimValue : 0
                };
            }
            else {
                return {
                    servicerData: {}
                };
            }
        });

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData?.name) &&
                emailRegex.test(entry?.email) &&
                phoneRegex.test(entry?.phoneNumber)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            data: filteredData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get dealer price book by id 
exports.getDealerPriceBookById = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let projection = {
            _id: 1,
            name: 1,
            wholesalePrice: {
                $sum: [
                    "$priceBooks.reserveFutureFee",
                    "$priceBooks.reinsuranceFee",
                    "$priceBooks.adminFee",
                    "$priceBooks.frontingFee",
                ],
            },
            "priceBook": 1,
            "dealerId": 1,
            "status": 1,
            "retailPrice": 1,
            "description": 1,
            "isDeleted": 1,
            "unique_key": 1,
            "__v": 1,
            "createdAt": 1,
            "updatedAt": 1,
            priceBooks: 1,
            dealer: 1
        }

        let query = { isDeleted: false, _id: new mongoose.Types.ObjectId(req.params.dealerPriceBookId) }
        let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)

        if (!getDealerPrice) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the dealer price books"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: getDealerPrice
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get Dealer Price Books
exports.getDealerPriceBookByDealerId = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let checkDealer = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { isDeleted: false })

        if (checkDealer.length == 0) {
            res.send({
                code: constant.errorCode,
                message: "Dealer Not found"
            })
            return;
        }
        let projection = {

            _id: 1,
            name: 1,
            wholesalePrice: {
                $sum: [
                    "$priceBooks.reserveFutureFee",
                    "$priceBooks.reinsuranceFee",
                    "$priceBooks.adminFee",
                    "$priceBooks.frontingFee",
                ],
            },
            "priceBook": 1,
            "dealerId": 1,
            "status": 1,
            "retailPrice": 1,
            "description": 1,
            "isDeleted": 1,
            "unique_key": 1,
            "__v": 1,
            "createdAt": 1,
            "updatedAt": 1,
            priceBooks: 1,
            dealer: 1

        }
        let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(req.params.dealerId) }
        let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
        if (!getDealerPrice) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the dealer price books"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: getDealerPrice
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get price book by filteration
exports.getAllPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        data.status = typeof (data.status) == "string" ? "all" : data.status
        let categorySearch = req.body.category ? req.body.category : ''
        let queryCategories = {
            $and: [
                { isDeleted: false },
                { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
            ]
        };
        let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
        let catIdsArray = getCatIds.map(category => category._id)
        let searchName = req.body.name ? req.body.name : ''
        let query

        if (data.status != 'all' && data.status != undefined) {
            if (data.coverageType != "") {
                query = {
                    $and: [
                        { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                        { 'priceBooks.coverageType': data.coverageType },
                        { 'priceBooks.category._id': { $in: catIdsArray } },
                        { 'status': data.status },
                        {
                            dealerId: new mongoose.Types.ObjectId(data.dealerId)
                        }
                    ]
                };
            } else {
                query = {
                    $and: [
                        { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                        { 'priceBooks.category._id': { $in: catIdsArray } },
                        { 'status': data.status },
                        {
                            dealerId: new mongoose.Types.ObjectId(data.dealerId)
                        }
                    ]
                };
            }

        } else if (data.coverageType != "") {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.coverageType': data.coverageType },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    {
                        dealerId: new mongoose.Types.ObjectId(data.dealerId)
                    }
                ]
            };
        } else {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    {
                        dealerId: new mongoose.Types.ObjectId(data.dealerId)
                    }
                ]
            };
        }
        if (data.term != "") {
            query.$and.push({ 'priceBooks.term': Number(data.term) });
        }

        if (data.priceType != '') {
            query.$and.push({ 'priceBooks.priceType': data.priceType });
            if (data.priceType == 'Flat Pricing') {

                if (data.range != '') {
                    query.$and.push({ 'priceBooks.rangeStart': { $lte: Number(data.range) } });
                    query.$and.push({ 'priceBooks.rangeEnd': { $gte: Number(data.range) } });
                }
            }
        }

        let projection = { isDeleted: 0, __v: 0 }

        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let limit = req.body.limit ? req.body.limit : 10000
        let page = req.body.page ? req.body.page : 1
        const priceBooks = await dealerPriceService.getAllPriceBooksByFilter(query, projection, limit, page);

        if (!priceBooks) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: priceBooks
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get dealer price book by filteration
exports.getAllDealerPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        data.status = typeof (data.status) == "string" ? "all" : data.status
        let categorySearch = req.body.category ? req.body.category : ''
        let queryCategories = {
            $and: [
                { isDeleted: false },
                { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
            ]
        };
        let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
        let catIdsArray = getCatIds.map(category => category._id)
        let searchDealerName = req.body.name ? req.body.name : ''
        let query
        let matchConditions = [];
        matchConditions.push({ 'priceBooks.category._id': { $in: catIdsArray } });

        if (data.status != 'all' && data.status != undefined) {
            matchConditions.push({ 'status': data.status });
        }

        if (data.term) {
            matchConditions.push({ 'priceBooks.term': Number(data.term) });
        }

        if (data.priceType != '') {
            matchConditions.push({ 'priceBooks.priceType': data.priceType });
            if (data.priceType == 'Flat Pricing') {
                if (data.range != '') {
                    matchConditions.push({ 'priceBooks.rangeStart': { $lte: Number(data.range) } });
                    matchConditions.push({ 'priceBooks.rangeEnd': { $gte: Number(data.range) } });
                }

            }
        }

        if (data.coverageType) {
            matchConditions.push({ 'priceBooks.coverageType': data.coverageType });
        }

        if (data.name) {
            matchConditions.push({ 'priceBooks.name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } });
        }

        if (data.pName) {
            matchConditions.push({ 'priceBooks.pName': { '$regex': req.body.pName ? req.body.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } });
        }

        if (data.dealerName) {
            matchConditions.push({ 'dealer.name': { '$regex': req.body.dealerName ? req.body.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } });
        }

        const matchStage = matchConditions.length > 0 ? { $match: { $and: matchConditions } } : {};
        let projection = { isDeleted: 0, __v: 0 }
        let limit = req.body.limit ? req.body.limit : 10000
        let page = req.body.page ? req.body.page : 1
        const priceBooks = await dealerPriceService.getAllDealerPriceBooksByFilter(matchStage, projection, limit, page);

        if (!priceBooks) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: priceBooks,
            matchStage
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

// get all dealers 
exports.getAllDealers = async (req, res) => {
    try {

        let data = req.body

        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let dealerFilter = {
            $and: [
                { isDeleted: false },
                { status: "Approved" },
                { 'name': { '$regex': req.body.name ? req.body.name.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } }
            ]
        };

        let projection = { __v: 0, isDeleted: 0 }
        let dealers = await dealerService.getAllDealers(dealerFilter, projection);
        const dealerIds = dealers.map(obj => obj._id);
        let query1 = { metaId: { $in: dealerIds }, isPrimary: true };

        //-------------Get All Dealers Id's------------------------

        let dealarUser = await userService.getMembers(query1, projection)

        //Get Dealer Order Data     
        let orderQuery = { dealerId: { $in: dealerIds }, status: "Active" };
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

        let orderData = await orderService.getAllOrderInCustomers(orderQuery, project, "$dealerId");

        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        const result_Array = dealarUser.map(item1 => {
            const matchingItem = dealers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const orders = orderData.find(order => order._id.toString() === item1.metaId.toString())
            if (matchingItem || orders) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    dealerData: matchingItem.toObject(),
                    ordersData: orders ? orders : {}
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber : '', 'i')
        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.dealerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            data: filteredData
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get Pending Request dealers
exports.getPendingDealers = async (req, res) => {
    try {
        let data = req.body
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let dealerFilter = {
            $and: [
                { isDeleted: false },
                { status: "Pending" },
                { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
            ]

        };

        let projection = { __v: 0, isDeleted: 0 }
        let dealers = await dealerService.getAllDealers(dealerFilter, projection);
        //-------------Get All Dealers Id's------------------------

        const dealerIds = dealers.map(obj => obj._id);

        let query1 = { metaId: { $in: dealerIds }, isPrimary: true };
        let dealarUser = await userService.getMembers(query1, projection)

        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        const result_Array = dealarUser.map(item1 => {
            const matchingItem = dealers.find(item2 => item2._id.toString() === item1.metaId.toString());

            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    dealerData: matchingItem.toObject()
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.dealerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            data: filteredData
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//get dealer detail by ID
exports.getDealerById = async (req, res) => {
    try {
        //fetching data from user table
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId });

        if (!dealers[0]) {
            res.send({
                code: constant.errorCode,
                message: "No data found"
            });
            return
        }

        const query1 = { metaId: { $in: [dealers[0]._id] }, isPrimary: true };
        let dealarUser = await userService.getMembers(query1, { isDeleted: false })

        if (!dealarUser) {
            res.send({
                code: constant.errorCode,
                message: "No any user of this dealer"
            });
            return
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
        }

        let query = {
            $and: [
                { dealerId: new mongoose.Types.ObjectId(req.params.dealerId), status: "Active" }
            ]
        }
        let ordersResult = await orderService.getAllOrderInCustomers(query, project, "$dealerId");
        //Get Claim Result 
        const claimQuery = { claimFile: 'Completed' }
        let lookupQuery = [
            {
                $match: claimQuery
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
                    ]
                },
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

        let valueClaim = await claimService.getClaimWithAggregate(lookupQuery);
        const rejectedQuery = { claimFile: "Completed" }
        //Get number of claims
        let numberOfCompleletedClaims = [
            {
                $match: claimQuery
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
                    ]
                },
            },
        ]
        let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim[0]?.totalAmount
        }
        const result_Array = dealarUser.map(item1 => {
            const matchingItem = dealers.find(item2 => item2._id.toString() === item1.metaId.toString());
            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    dealerData: matchingItem.toObject(),
                    ordersResult: ordersResult,
                    claimData: claimData
                };
            } else {
                return dealerData.toObject();
            }
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: result_Array,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    };
};

//get dealer detail by ID
exports.getUserByDealerId = async (req, res) => {
    try {
        let data = req.body
        //fetching data from user table
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        const dealers = await dealerService.getDealerById(req.params.dealerId);
        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found"
            });
            return;
        };

        const users = await dealerService.getUserByDealerId({ metaId: req.params.dealerId, isDeleted: false });

        let name = data.firstName ? data.firstName : ""
        let nameArray = name.trim().split(" ");
        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };
        const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
        const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        let filteredData = users.filter(entry => {
            return (
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        if (!users) {
            res.send({
                code: constant.errorCode,
                message: "No data found"
            });
            return
        }

        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData,
            dealerData: dealers,
            dealerStatus: dealers.accountStatus,
            isAccountCreate: dealers.isAccountCreate,
            userAccount: dealers.userAccount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    };
};
