require('dotenv').config()
const USER = require('../../models/User/users')
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService")
const servicerService = require("../../services/Provider/providerService")
const claimService = require("../../services/Claim/claimService")
const contractService = require("../../services/Contract/contractService")
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerRelation = require("../../models/Provider/dealerServicer")
const userService = require("../../services/User/userService");
const role = require("../../models/User/role");
const dealer = require("../../models/Dealer/dealer");
const constant = require('../../config/constant')
const providerService = require('../../services/Provider/providerService');
const { getServicer } = require('../../controllers/Provider/serviceAdminController');
const resellerService = require('../../services/Dealer/resellerService');
const moment = require("moment");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const json2csv = require('json-2-csv').json2csv;
const multer = require('multer');
const csvParser = require('csv-parser');
const { isBoolean } = require('util');
const { string } = require('joi');

//Get dashboard graph
exports.getDashboardGraph = async (req, res) => {
    try {
        let data = req.body
        let endOfMonth1s = new Date();
        let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));
        let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));
        let startOfMonths = new Date(startOfMonth2s.getFullYear(), startOfMonth2s.getMonth(), startOfMonth2s.getDate());
        let startOfMonth1s = new Date(startOfYear2s.getFullYear(), startOfYear2s.getMonth(), startOfYear2s.getDate());
        let endOfMonths = new Date(endOfMonth1s.getFullYear(), endOfMonth1s.getMonth(), endOfMonth1s.getDate() + 1);
        let orderQuery = [
            {
                $match: {
                    updatedAt: { $gte: startOfMonths, $lte: endOfMonths },
                    status: "Active",
                    dealerId: new mongoose.Types.ObjectId(req.userId),


                }
            },
            {
                $unwind: "$productsArray"
            },
            {
                $group: {
                    _id: "$productsArray.priceBookDetails.name",
                    totalPrice: { $sum: "$productsArray.price" },
                    // term: "$productsArray.term",
                }
            },
            {
                $project: {
                    _id: 0,
                    priceBookName: "$_id",
                    totalPrice: 1,
                    term: 1,

                }
            },
            {
                $sort: { totalPrice: -1 }
            }

        ]

        let orderQuery1 = [
            {
                $match: {
                    updatedAt: { $gte: startOfMonth1s, $lte: endOfMonths },
                    dealerId: new mongoose.Types.ObjectId(req.userId),
                    status: "Active"
                }
            },
            {
                $unwind: "$productsArray"
            },
            {
                $group: {
                    _id: "$productsArray.priceBookDetails.name",
                    totalPrice: { $sum: "$productsArray.price" }
                }
            },
            {
                $project: {
                    _id: 0,
                    priceBookName: "$_id",
                    totalPrice: 1
                }
            },
            {
                $sort: { totalPrice: -1 }
            }

        ]

        let endOfMonth1 = new Date();
        let startOfMonth2 = new Date(new Date().setDate(new Date().getDate() - 30));
        let startOfMonth = new Date(startOfMonth2.getFullYear(), startOfMonth2.getMonth(), startOfMonth2.getDate());
        let endOfMonth = new Date(endOfMonth1.getFullYear(), endOfMonth1.getMonth(), endOfMonth1.getDate() + 1);

        if (isNaN(startOfMonth) || isNaN(endOfMonth)) {
            return { code: 401, message: "invalid date" };
        }

        let datesArray = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            datesArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    dealerId: new mongoose.Types.ObjectId(req.userId),
                    claimStatus: {
                        $elemMatch: { status: "completed" }
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_amount: { $sum: "$totalAmount" },
                    total_claim: { $sum: 1 },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    dealerId: new mongoose.Types.ObjectId(req.userId),
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    status: "Active"
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    order_amount: { $sum: "$orderAmount" },
                    total_order: { $sum: 1 },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let getData = await claimService.getClaimWithAggregate(dailyQuery)
        let getData2 = await orderService.getAllOrders1(dailyQuery1)
        let getOrders = await orderService.getAllOrders1(orderQuery)
        let getOrders1 = await orderService.getAllOrders1(orderQuery1)
        let priceBookNames = getOrders.map(ID => ID.priceBookName)
        let priceBookName1 = getOrders1.map(ID => ID.priceBookName)

        let priceQuery = {
            name: { $in: priceBookNames }
        }

        let priceQuery1 = {
            name: { $in: priceBookName1 }
        }


        let getPriceBooks = await priceBookService.getAllActivePriceBook(priceQuery)

        let getPriceBooks1 = await priceBookService.getAllActivePriceBook(priceQuery1)

        const result = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                total_amount: order ? order.total_amount : 0,
                total_claim: order ? order.total_claim : 0,

            };
        });

        const result1 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData2.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                order_amount: order ? order.order_amount : 0,
                total_order: order ? order.total_order : 0,
            };
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            claim_result: result,
            order_result: result1,
            monthly_sku: getPriceBooks,
            yealy_sku: getPriceBooks1
        })


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get dashboard info
exports.getDashboardInfo = async (req, res) => {
    let orderQuery = [
        {
            $match: { status: "Active", dealerId: new mongoose.Types.ObjectId(req.userId) },

        },
        {
            "$addFields": {
                "noOfProducts": {
                    "$sum": "$productsArray.checkNumberProducts"
                },
                totalOrderAmount: { $sum: "$orderAmount" },

            }
        },
        { $sort: { updatedAt: -1 } },
        {
            $limit: 5
        },
    ]

    const lastFiveOrder = await orderService.getOrderWithContract1(orderQuery, 1, 5)

    const claimQuery = [
        {
            $match: {
                $and: [
                    {
                        dealerId: new mongoose.Types.ObjectId(req.userId)
                    },
                    {
                        claimFile: "completed"
                    }
                ]
            }
        },
        {
            $sort: {
                updatedAt: -1
            }
        },
        {
            $limit: 5
        },
        {
            $lookup: {
                from: "contracts",
                localField: "contractId",
                foreignField: "_id",
                as: "contract"
            }
        },
        {
            $unwind: "$contract"
        },
        {
            $project: {
                unique_key: 1,
                "contract.unique_key": 1,
                unique_key_number: 1,
                totalAmount: 1
            }
        },
    ]
    const getLastNumberOfClaims = await claimService.getClaimWithAggregate(claimQuery, {})

    const result = {
        lastFiveOrder: lastFiveOrder,
        lastFiveClaims: getLastNumberOfClaims,

    }
    res.send({
        code: constant.successCode,
        result: result
    })
}

//users api
exports.getDealerUsers = async (req, res) => {
    try {
        let data = req.body
        const dealers = await dealerService.getSingleDealerById({ _id: req.userId }, { accountStatus: 1 });

        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found"
            });
            return;
        };
        const users = await dealerService.getUserByDealerId({ metaId: req.userId, isDeleted: false });

        let name = data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : ""
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


        const filteredData = users.filter(entry => {
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
            dealerStatus: dealers[0].accountStatus,
            isAccountCreate: dealers[0].isAccountCreate
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

// get dealer price book by ID
exports.getDealerPriceBookById = async (req, res) => {
    try {
        let projection = {
            _id: 1,
            name: 1,
            dealerSku: 1,
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
            adhDays: 1,
            noOfClaim: 1,
            noOfClaimPerPeriod: 1,
            isManufacturerWarranty: 1,
            isMaxClaimAmount: 1,
            dealer: 1
        }
        let query = { isDeleted: false, _id: new mongoose.Types.ObjectId(req.params.dealerPriceBookId) }
        let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)

        //Get dealer coverageType
        const dealerCoverage = getDealerPrice[0]?.dealer.coverageType


        getDealerPrice[0].adhDays1 = [];

        // Iterate through each adhDays item (assumed to be dealer coverage details)
        getDealerPrice[0].dealer.adhDays.forEach(adhDayItem => {

            // Iterate over each option in the priceBooks options
            getDealerPrice[0].priceBooks.options.forEach(option => {

                // Find the matching adhDayItem.label value in the option array
                const matchingValue = option.value.find(optValue => optValue.value === adhDayItem.value);

                // If there's a match, push it into the optionDropdown array
                if (matchingValue) {
                    getDealerPrice[0].adhDays1.push({ ...matchingValue, waitingDays: adhDayItem.waitingDays, deductible: adhDayItem.deductible, amountType: adhDayItem.amountType });
                }
            });
        });
        let firstArray = getDealerPrice[0].adhDays
        let secondArray = getDealerPrice[0].adhDays1

        const valuesToMatch = new Set(firstArray.map(item => item.value));

        // Filter the second array
        const filteredAdhDays1 = secondArray.filter(item => valuesToMatch.has(item.value));
        getDealerPrice[0].adhDays1 = filteredAdhDays1

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
};

//Get price books
exports.getPriceBooks = async (req, res) => {
    try {
        let checkDealer = await dealerService.getSingleDealerById({ _id: req.userId }, { isDeleted: false })

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
            "priceBook": 1,
            "dealerSku": 1,
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
        let query
        query = { isDeleted: false, status: true, dealerId: new mongoose.Types.ObjectId(req.userId) }
        const coverageType = checkDealer[0]?.coverageType
        let lookupQuery
        lookupQuery = [
            {
                $match: query
            },
            {
                $lookup: {
                    from: "pricebooks",
                    localField: "priceBook",
                    foreignField: "_id",
                    as: "priceBooks",
                    pipeline: [
                        {
                            $match: {
                                'coverageType': { $elemMatch: { value: { $in: coverageType } } },
                            }
                        },
                        {
                            $lookup: {
                                from: "pricecategories",
                                localField: "category",
                                foreignField: "_id",
                                as: "category"
                            }
                        },

                    ]
                }
            },
            { $unwind: "$priceBooks" },
            {
                $lookup: {
                    from: "dealers",
                    localField: "dealerId",
                    foreignField: "_id",
                    as: "dealer",
                },
            },
            { $unwind: "$dealer" },
            {
                $project: projection
            },
            {
                $addFields: {
                    brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
                },
            },


        ]

        // if (checkDealer[0]?.coverageType != "Breakdown & Accidental") {
        //     lookupQuery = [
        //         {
        //             $match: query
        //         },
        //         {
        //             $lookup: {
        //                 from: "pricebooks",
        //                 localField: "priceBook",
        //                 foreignField: "_id",
        //                 as: "priceBooks",
        //                 pipeline: [
        //                     {
        //                         $match: {
        //                             coverageType: checkDealer[0]?.coverageType
        //                         }
        //                     },
        //                     {
        //                         $lookup: {
        //                             from: "pricecategories",
        //                             localField: "category",
        //                             foreignField: "_id",
        //                             as: "category"
        //                         }
        //                     },

        //                 ]
        //             }
        //         },
        //         { $unwind: "$priceBooks" },
        //         {
        //             $lookup: {
        //                 from: "dealers",
        //                 localField: "dealerId",
        //                 foreignField: "_id",
        //                 as: "dealer",
        //             },
        //         },
        //         { $unwind: "$dealer" },
        //         {
        //             $project: projection
        //         },
        //         {
        //             $addFields: {
        //                 brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
        //             },
        //         },


        //     ]
        // } else {
        //     lookupQuery = [
        //         {
        //             $match: query
        //         },
        //         {
        //             $lookup: {
        //                 from: "pricebooks",
        //                 localField: "priceBook",
        //                 foreignField: "_id",
        //                 as: "priceBooks",
        //                 pipeline: [
        //                     {
        //                         $lookup: {
        //                             from: "pricecategories",
        //                             localField: "category",
        //                             foreignField: "_id",
        //                             as: "category"
        //                         }
        //                     },

        //                 ]
        //             }
        //         },
        //         { $unwind: "$priceBooks" },
        //         {
        //             $lookup: {
        //                 from: "dealers",
        //                 localField: "dealerId",
        //                 foreignField: "_id",
        //                 as: "dealer",
        //             },
        //         },
        //         { $unwind: "$dealer" },
        //         {
        //             $project: projection
        //         },
        //         {
        //             $addFields: {
        //                 brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
        //             },
        //         },


        //     ]
        // }

        let getDealerPrice = await dealerPriceService.getDealerPriceBookById1(lookupQuery)
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
};

// get reseller customers by Id
exports.getResellerCustomers = async (req, res) => {
    try {
        if (req.role !== "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer is allowed to perform this action"
            });
            return
        }
        let data = req.body;
        let query = { isDeleted: false, resellerId: req.params.resellerId }
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id);
        const orderCustomerIds = customers.map(obj => obj._id);
        let getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: customersId }, isPrimary: true } } }
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
                { customerId: { $in: orderCustomerIds }, status: "Active" },
                {
                    'venderOrder': { '$regex': req.body.venderOrderNumber ? req.body.venderOrderNumber : '', '$options': 'i' },
                },
            ]
        }
        let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$customerId');

        let result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.metaId)
            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem.toObject(),
                    orderData: order ? order : {}
                };
            } else {
                return {};
            }
        });

        const nameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        result_Array = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.customerData.username) &&
                dealerRegex.test(entry.customerData.dealerId)
            );
        });

        res.send({
            code: constant.successCode,
            result: result_Array
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get price book with filter
exports.getAllPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        //data.status = typeof (data.status) == "string" ? "all" : data.status
        let categorySearch = req.body.category ? req.body.category : ''
        let checkDealer = await dealerService.getDealerById(req.userId, { isDeleted: false });
        let queryCategories = {
            $and: [
                { isDeleted: false },
                { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
            ]
        };
        if (!Array.isArray(data.coverageType) && data.coverageType != '') {
            res.send({
                code: constant.errorCode,
                message: "Coverage type should be an array!"
            });
            return;
        }
        let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
        let catIdsArray = getCatIds.map(category => category._id)
        let searchName = req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : ''
        let dealerSku = req.body.dealerSku ? req.body.dealerSku.replace(/\s+/g, ' ').trim() : ''
        let searchPName = req.body.pName ? req.body.pName.replace(/\s+/g, ' ').trim() : ''
        let priceType = req.body.priceType ? req.body.priceType.replace(/\s+/g, ' ').trim() : ''
        let query


        if (data.coverageType == "") {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.pName': { '$regex': searchPName, '$options': 'i' } },
                    { 'priceBooks.priceType': { '$regex': priceType, '$options': 'i' } },
                    { 'priceBooks.coverageType': { $elemMatch: { value: { $in: checkDealer.coverageType } } } },

                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'status': true },
                    { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
                    { dealerId: new mongoose.Types.ObjectId(req.userId) }
                ]
            }


        } else {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.priceType': { '$regex': priceType, '$options': 'i' } },
                    { 'priceBooks.pName': { '$regex': searchPName, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'priceBooks.coverageType.value': { $all: data.coverageType } },
                    { "priceBooks.coverageType": { $size: data.coverageType.length } },
                    { 'status': true },
                    { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
                    { dealerId: new mongoose.Types.ObjectId(req.userId) }
                ]
            };
        }
        // Conditionally add the term query if data.term is not blank
        if (data.term) {
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

//Get reseller price book
exports.getResellerPriceBook = async (req, res) => {
    if (req.role != "Dealer") {
        res.send({
            code: constant.errorCode,
            message: "Only Dealer allow to do this action"
        })
        return;
    }
    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    let dealerSku = req.body.dealerSku ? req.body.dealerSku.replace(/\s+/g, ' ').trim() : ''
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }

    let checkDealer = await dealerService.getDealerById(checkReseller.dealerId, { isDeleted: false });
    if (!checkDealer) {
        res.send({
            code: constant.errorCode,
            message: 'Dealer not found of this reseller!'
        });
        return;
    }

    let queryCategories = {
        $and: [
            { isDeleted: false },
            { 'name': { '$regex': req.body.category.replace(/\s+/g, ' ').trim() ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
        ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let projection = { isDeleted: 0, __v: 0 }
    let query = {
        $and: [
            { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
            { 'priceBooks.category._id': { $in: catIdsArray } },
            { 'status': true },
            { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },

            {
                dealerId: new mongoose.Types.ObjectId(checkDealer._id)
            },
            {
                isDeleted: false
            }
        ]
    }

    let getResellerPriceBook = await dealerPriceService.getAllPriceBooksByFilter(query, projection)

    if (!getResellerPriceBook) {
        res.send({
            code: constant.errorCode,
            message: 'Unable to find price books!'
        });
        return;
    }

    res.send({
        code: constant.successCode,
        message: "Success",
        result: getResellerPriceBook
    })


};

//Get reseller users
exports.getResellerUsers = async (req, res) => {
    if (req.role != "Dealer") {
        res.send({
            code: constant.errorCode,
            message: "Only Dealer allow to do this action"
        })
        return;
    }

    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }

    const users = await userService.findUserforCustomer1([
        {
            $match: {
                $and: [
                    { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                    { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                    { metaData: { $elemMatch: { metaId: checkReseller._id, isPrimary: true } } }
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

    res.send({
        code: constant.successCode,
        data: users
    });
    return;
};

//servicers api
exports.getResellerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller ID"
            })
            return;
        }

        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }

        let result_Array = []
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: checkReseller.dealerId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }

        let ids = getServicersIds.map((item) => item.servicerId)
        var servicer = await providerService.getAllServiceProvider({ _id: { $in: ids } }, {})

        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }

        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }

        if (checkReseller.isServicer) {
            servicer.unshift(checkReseller);
        }

        const servicerIds = servicer.map(obj => obj._id);


        const servicerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                message: "Unable to fetch the data"
            });
            return;
        };

        result_Array = servicer.map(servicer => {
            const matchingItem = servicerUser.find(user => user.metaId.toString() === servicer._id.toString() || user.metaId.toString() === servicer.dealerId?.toString() || user.metaId.toString() === servicer.resellerId?.toString())
            if (matchingItem) {
                return {
                    ...matchingItem, // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: servicer.toObject()
                };
            } else {
                return servicer.toObject();
            }
        })

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData.name)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            data: filteredData
        });
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

        let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.userId })

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

        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        };

        // Get Dealer Reseller Servicer

        let dealerResellerServicer = await resellerService.getResellers({ dealerId: req.userId, isServicer: true })

        if (dealerResellerServicer.length > 0) {
            servicer.unshift(...dealerResellerServicer);
        }
        // console.log("servicerIds1---------------00000000000------------------",servicer);

        let servicerIds = servicer.map(obj => obj._id);
        const servicerIds1 = servicer.map(obj => new mongoose.Types.ObjectId(obj.dealerId));
        const servicerIds2 = servicer.map(obj => new mongoose.Types.ObjectId(obj.resellerId));
        // console.log("servicerIds1---------------------------------",servicerIds);
        // console.log("servicerIds++++---------------------------------",servicerIds1);
        servicerIds = servicerIds.concat(servicerIds1);
        servicerIds = servicerIds.concat(servicerIds2);
        console.log("servicerIds---------------------------------", servicerIds);
        const query1 = { metaId: { $in: servicerIds }, isPrimary: true };
        const servicerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                message: "Unable to fetch the data"
            });
            return;
        };
        // console.log("serviffffffff============cerIds1---------------------------------",servicerUser);

        // Get servicer with claim
        const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: "completed" };
        const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "completed" };
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
            const matchingItem = servicerUser.find(item2 => item2.metaId?.toString() === item1?._id?.toString() || item2.metaId?.toString() === item1?.dealerId?.toString() || item2.metaId?.toString() === item1?.resellerId?.toString());
            const claimValue = valueClaim.find(claim => claim._id?.toString() === item1._id?.toString())
            const claimNumber = numberOfClaims.find(claim => claim._id?.toString() === item1._id?.toString())
            if (matchingItem) {
                return {
                    ...matchingItem, // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: item1.toObject(),
                    claimNumber: claimNumber ? claimNumber : {
                        "_id": "",
                        "noOfOrders": 0
                    },
                    claimValue: claimValue ? claimValue : {
                        "_id": "",
                        "totalAmount": 0
                    }
                };
            }
            else {
                return {
                    servicerData: {}
                };
            }
        });
        let emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        let nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        let phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

        let filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData?.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        // Add isServicer key for reseller when true
        filteredData.forEach(item => {
            // Check if resellerId is not null
            if (item.servicerData.resellerId !== null) {
                // Add the desired key-value pair inside servicerData object
                item.servicerData.isServicer = true;
                // You can add any key-value pair you want here
            }
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            data: filteredData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.stack
        })
    }
}

//Get servicer list
exports.getServicersList = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false, accountStatus: "Approved", status: true }
        let projection = { __v: 0, isDeleted: 0 }
        let servicer = await providerService.getAllServiceProvider(query, projection);
        let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.userId })
        const dealerReseller = await resellerService.getResellers({ dealerId: req.userId, status: true });


        const resultArray = servicer.map(item => {
            const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
            const documentData = item._doc;
            return { ...documentData, check: !!matchingServicer };
        });

        let filteredData = resultArray.filter(item =>
            // console.log("item+++++++++++++++++++++++++",item)
            item !== undefined && item.dealerId?.toString() != req.params.dealerId?.toString() && !dealerReseller.some(
                reseller => reseller._id?.toString() === item.resellerId?.toString()
            )

        );
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
};

//Get dealer customer
exports.getDealerCustomers = async (req, res) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            });
            return
        }
        let data = req.body
        let query = { isDeleted: false, dealerId: req.userId }
        if (data.resellerName != "" && data.resellerName != undefined) {
            let getResellers = await resellerService.getResellers({ name: { '$regex': req.body.resellerName, '$options': 'i' } })
            const resellerIds = getResellers.map(obj => obj._id.toString());
            if (resellerIds.length == 0) {
                query = { isDeleted: false, dealerId: req.userId, resellerId1: { $in: ["1111121ccf9d400000000000"] } }

            } else {
                query = { isDeleted: false, dealerId: req.userId, resellerId1: { $in: resellerIds } }
            }
        }
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id);
        const customersOrderId = customers.map(obj => obj._id);
        const customersResellerId = customers.map(obj => obj.resellerId);
        const queryUser = { metaId: { $in: customersId }, isPrimary: true };
        //Get Customer Resellers
        let resellerData = await resellerService.getResellers({ _id: { $in: customersResellerId } }, {})
        let name = data.firstName ? data.firstName : ""

        let nameArray = name.split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')

        const getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { lastName: { '$regex': newObj.l_name ? newObj.l_name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { metaData: { $elemMatch: { firstName: { '$regex': newObj.f_name ? newObj.f_name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: customersId }, isPrimary: true } } }
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

        let orderQuery = { customerId: { $in: customersOrderId }, status: "Active" };
        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId")
        let result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id?.toString() === item1.metaId?.toString());
            const order = ordersData.find(order => order._id?.toString() === item1.metaId?.toString())
            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem,
                    order: order ? order : {}
                };
            } else {
                return dealerData.toObject();
            }
        });

        result_Array = result_Array.map(customer => {
            const resellerMatch = resellerData.find(reseller => reseller._id?.toString() === customer?.customerData?.resellerId?.toString());
            return {
                ...customer, // Use toObject() to convert Mongoose document to plain JavaScript object
                resellerInfo: resellerMatch ? resellerMatch.toObject() : {},
            };
        })




        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.customerData.username)
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

//Get customer in order
exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        // if (data.resellerId != "") {
        //     query = { dealerId: req.userId, resellerId: data.resellerId };
        // }
        // else {
        //     query = { dealerId: req.userId };
        // }

        if (data.resellerId != "") {
            // query = { dealerId: data.dealerId, resellerId: data.resellerId };
            query = [
                {
                    $match: {
                        $and: [
                            {
                                dealerId: new mongoose.Types.ObjectId(req.userId)
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
                    $match: { dealerId: new mongoose.Types.ObjectId(req.userId) }
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

        const customerIds = getCustomers.map(customer => customer?._id);

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
            const matchingItem = getCustomers.find(item2 => item2._id?.toString() === item1.metaId?.toString());
            if (matchingItem) {
                return {
                    ...matchingItem,
                    email: item1.email  // Use toObject() to convert Mongoose document to plain JavaScript object
                };
            } else {
                return dealerData.toObject();
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
    if (req.userId) {
        var checkDealer = await dealerService.getDealerById(req.userId, {
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
            dealerId: req.userId,
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
        if (checkServicer.status) {
            servicer.unshift(checkReseller);
        }
    }

    if (checkDealer && checkDealer.isServicer) {
        //Get the servicer name if dealer as servicer
        const checkServicer = await servicerService.getServiceProviderById({ dealerId: checkDealer._id })
        if (checkServicer.status) {
            servicer.unshift(checkDealer);
        }
    }
    const servicerIds = servicer.map((obj) => obj?._id);
    const resellerIdss = servicer.map((obj) => new mongoose.Types.ObjectId(obj?.resellerId));
    const dealerIdss = servicer.map((obj) => new mongoose.Types.ObjectId(obj?.dealerId));
    // const dealerIdss = servicer.map((obj) => obj?._id);
    const query1 = {
        $and: [
            {
                $or: [
                    { metaId: { $in: servicerIds } },
                    { metaId: { $in: resellerIdss } },
                    { metaId: { $in: dealerIdss } },
                ]
            },
            { isPrimary: true }
        ]
    };


    const servicerUser = await userService.findUserforCustomer1([
        {
            $match: {
                $and: [
                    { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                    { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                    {
                        $or: [
                            { metaData: { $elemMatch: { metaId: { $in: servicerIds }, isPrimary: true } } },
                            { metaData: { $elemMatch: { metaId: { $in: resellerIdss }, isPrimary: true } } },
                            { metaData: { $elemMatch: { metaId: { $in: dealerIdss }, isPrimary: true } } }
                        ]
                    }
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
            (item2) => item2.metaId?.toString() === item1?._id.toString() || item2.metaId?.toString() === item1?.dealerId?.toString() || item2.metaId?.toString() === item1?.resellerId?.toString());
        let matchingItem2 = servicerUser.find(
            (item2) => item2.metaId?.toString() === item1?.resellerId?.toString() || item2?.metaId?.toString() === item1?.dealerId?.toString());
        if (matchingItem) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem,
            };
        } else if (matchingItem2) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem2,
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

//Get reseller order
exports.getResellerOrders = async (req, res) => {
    try {
        let query = { _id: req.params.resellerId };
        let data = req.body
        let projection = { isDeleted: 0 }
        let checkReseller = await resellerService.getReseller(query, projection)
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found!'
            })
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
        let orderQuery = { resellerId: new mongoose.Types.ObjectId(req.params.resellerId), status: { $ne: "Archieved" } }
        let lookupQuery = [
            {
                $match: orderQuery
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "_id",
                    foreignField: "orderId",
                    as: "contract"
                }
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
                    keki: {
                        $map: {
                            input: "$contract",
                            as: "contract",
                            in: {
                                $mergeObjects: [
                                    "$$contract",
                                    {
                                        startRange: "$startRange",
                                        endRange: "$endRange"
                                    }
                                ]
                            }
                        }
                    }

                }
            },
            { $sort: { unique_key: -1 } }
        ]
        let ordersResult = await orderService.getOrderWithContract(lookupQuery);
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

        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId);
        const customerCreteria = { _id: { $in: customerIdsArray } };
        const allUserIds = mergedArray.concat(userCustomerIds);
        const queryUser = { metaId: { $in: allUserIds }, isPrimary: true };
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
                        (item2) => item2._id?.toString() === item1.dealerId.toString()
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
                        (item2) => item2._id?.toString() === item1.customerId?.toString()
                    )
                    : null;
            const resellerName =
                item1.resellerId != null
                    ? respectiveReseller.find(
                        (item2) => item2._id?.toString() === item1.resellerId?.toString()
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
        const status = new RegExp(data.status ? data.status.trim() : "", "i");

        let filteredData = result_Array.filter((entry) => {
            return (
                unique_keyRegex.test(entry.unique_key) &&
                venderOrderRegex.test(entry.venderOrder) &&
                status.test(entry.status)
            );
        });

        const updatedArray = filteredData.map(item => {
            let username = null; // Initialize username as null
            if (item.dealerName) {
                username = getPrimaryUser.find(user => user.metaId?.toString() === item.dealerName._id?.toString());
            }
            if (item.resellerName) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.resellerName._id?.toString()) : {};
            }
            if (item.customerName) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.customerName._id?.toString()) : {};
            }
            return {
                ...item,
                servicerName: item.dealerName.isServicer ? item.dealerName : item.resellerName.isServicer ? item.resellerName : item.servicerName,
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
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })

    }
};

//Get dealer reseller
exports.getDealerResellers = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.userId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.userId }
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
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { metaId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: resellerId }, isPrimary: true } } }
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

        //Get Reseller Orders
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
        let orderQuery = { resellerId: { $in: resellerOrderIds }, status: "Active" };
        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId")

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.metaId.toString())
            if (matchingItem || orders) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orders: orders ? orders : {}
                };
            } else {
                return dealerData.toObject();
            }
        });

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const statusRegex = new RegExp(data.status)

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.resellerData.name) &&
                statusRegex.test(entry.status) &&
                dealerRegex.test(entry.resellerData.dealerId)
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

//Get reseller for order
exports.getDealerResellersInOrder = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.userId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };
        let query = { isDeleted: false, dealerId: req.userId, status: true }
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
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { metaId: { $in: resellerId }, isPrimary: true };
        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
        //Get Reseller Orders
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
        let orderQuery = { resellerId: { $in: resellerOrderIds }, status: "Active" };
        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId")
        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.metaId.toString())
            if (matchingItem || orders) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orders: orders ? orders : {}
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const statusRegex = new RegExp(data.status)
        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                statusRegex.test(entry.status) &&
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

//order api
exports.getDealerOrders = async (req, res) => {
    try {
        {
            let data = req.body;
            if (req.role != "Dealer") {
                res.send({
                    code: constant.errorCode,
                    message: "Only dealer allow to do this action",
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
            let query = { status: { $ne: "Archieved" }, dealerId: new mongoose.Types.ObjectId(req.userId) };
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
            let servicerIdArray = ordersResult.map((result) => result?.servicerId);
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

            let customerIdsArray = ordersResult.map((result) => result?.customerId);

            let userCustomerIds = ordersResult
                .filter(result => result.customerId !== null)
                .map(result => result.customerId);
            const customerCreteria = { _id: { $in: customerIdsArray } };

            const allUserIds = mergedArray.concat(userCustomerIds);
            const queryUser = { metaId: { $in: allUserIds }, isPrimary: true };

            const getPrimaryUser = await userService.findUserforCustomer1([
                {
                    $match: {
                        $and: [
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
            let resellerIdsArray = ordersResult.map((result) => result?.resellerId);
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
                    servicerName: (item.dealerName.isServicer && item.servicerId?.toString() == item.dealerName._id?.toString()) ? item.dealerName : (item.resellerName.isServicer && item.servicerId?.toString() == item.resellerName._id?.toString()) ? item.resellerName : item.servicerName,
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
        };
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get dealer archeived order
exports.getDealerArchievedOrders = async (req, res) => {
    try {
        {
            let data = req.body;
            if (req.role != "Dealer") {
                res.send({
                    code: constant.errorCode,
                    message: "Only dealer allow to do this action",
                });
                return;
            }
            let query = { status: "Archieved", dealerId: new mongoose.Types.ObjectId(req.userId) };

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

            let userCustomerIds = ordersResult
                .filter(result => result.customerId !== null)
                .map(result => result.customerId);
            const customerCreteria = { _id: { $in: customerIdsArray } };

            const allUserIds = mergedArray.concat(userCustomerIds);
            const queryUser = { metaId: { $in: allUserIds }, isPrimary: true };
            const getPrimaryUser = await userService.findUserforCustomer1([
                {
                    $match: {
                        $and: [

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
                    servicerName: (item.dealerName.isServicer && item.servicerId != null) ? item.dealerName : (item.resellerName.isServicer && item.servicerId != null) ? item.resellerName : item.servicerName,
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
        };
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Get dealer contracts
exports.getAllContracts = async (req, res) => {
    try {
        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        // let getTheThresholdLimir = await userService.getUserById1({ roleId: process.env.super_admin, isPrimary: true })
        let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

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
        if (customerIds.length > 0) {
            orderAndCondition.push({ customerId: { $in: customerIds } })

        }
        if (resellerIds.length > 0) {
            orderAndCondition.push({ resellerId: { $in: resellerIds } })
        }
        if (req.role == 'Dealer') {
            userSearchCheck = 1
            orderAndCondition.push({ dealerId: { $in: [req.userId] } })
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

        if (data.startDate != "") {
            let startDate = new Date(data.startDate)
            let endDate = new Date(data.endDate)
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 999, 0)
            let dateFilter = { createdAt: { $gte: startDate, $lte: endDate } }
            contractFilterWithEligibilty.push(dateFilter)
        }
        let mainQuery = []
        if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
            mainQuery = [
                {
                    $facet: {
                        totalRecords: [
                            {
                                $count: "total"
                            }
                        ],
                        data: [
                            { $sort: { unique_key_number: -1 } },
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
                                    createdAt: 1,
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
                        { $sort: { unique_key_number: -1 } },

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
                                minDate: 1,
                                createdAt: 1,
                                unique_key: 1,
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
                if (checkClaims[0].isMaxClaimAmount) {

                    if (checkClaims[0].totalAmount >= result1[e].productValue) {
                        result1[e].reason = "Claim value exceed the product value limit"
                    }
                }
            }
            let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
            const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
            let overThreshold = result1[e].claimAmount > thresholdLimitValue;
            let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
            if (!overThreshold) {
                threshHoldMessage = ""
            }
            if (!thresholdLimitPercentage.isThreshHoldLimit) {
                overThreshold = false
                threshHoldMessage = ""
            }
            result1[e].threshHoldMessage = threshHoldMessage
            result1[e].overThreshold = overThreshold
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
};

//Get category and price books
exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body;
        let checkDealer = await dealerService.getDealerById({ _id: req.userId })
        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
            dealerId: req.userId,
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
        // let newQuery = { _id: { $in: dealerPriceIds }, coverageType: coverageType, status: true, };
        let newQuery = {
            _id: { $in: dealerPriceIds }, "coverageType.value": { "$all": coverageType },
            "coverageType": { "$size": coverageType.length }, status: true,
        };
        let getPriceBooksForAllCat = await priceBookService.getAllPriceIds(newQuery, {});
        let uniqueCategory1 = {}

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
            // query = { _id: { $in: dealerPriceIds }, status: true, coverageType: coverageType, term: data.term };
            query = {
                _id: { $in: dealerPriceIds }, status: true, term: data.term, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };
        }

        else if (data.pName != "" && data.term == "") {
            // query = { _id: { $in: dealerPriceIds }, status: true, coverageType: coverageType, pName: data.pName };
            query = {
                _id: { $in: dealerPriceIds }, status: true, pName: data.pName, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };

        }

        else if (data.term != "" && data.pName != "") {
            // query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, coverageType: coverageType, term: data.term };
            query = {
                _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }
            };
        } else {
            // query = { _id: { $in: dealerPriceIds }, coverageType: coverageType, status: true, };
            query = {
                _id: { $in: dealerPriceIds }, "coverageType.value": { "$all": coverageType },
                "coverageType": { "$size": coverageType.length }, status: true,
            };
        }
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
            adhDays: [],
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
                dealerId: req.userId,
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
        mergedPriceBooks = mergedPriceBooks.map((item) => {
            // Find the matching dealerPriceBookDetail object
            const matchingDetail = getDealerPriceBook.find(detail =>
                item._id.toString() === detail.priceBook.toString()
            );

            // If a match is found, add the dealerSku key
            if (matchingDetail) {
                return {
                    ...item,
                    dealerSku: matchingDetail.dealerSku,
                    adhDays: matchingDetail.adhDays,
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
            priceBooks: data.priceCatId == "" ? [] : mergedPriceBooks,
            productName: data.priceCatId == "" ? [] : uniqueProductName,
            terms: data.priceCatId == "" ? [] : uniqueTerms,
            selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
            dealerPriceBookDetail: dealerPriceBookDetail,
            dealerPriceBook: getDealerPriceBook,
            mergedData,
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

//Get dashboard data
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

        let query = { status: 'Active', dealerId: new mongoose.Types.ObjectId(req.userId) };
        const claimQuery = { claimFile: 'completed' }
        var checkOrders_ = await orderService.getDashboardData(query, project);
        //Get claims data
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.userId) },
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

        const rejectedQuery = { claimFile: { $ne: "rejected" } }
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.userId) },
                    ]
                },
            },
        ]

        let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim.length > 0 ? valueClaim[0]?.totalAmount : 0
        }

        if (!checkOrders_[0] && numberOfClaims.length == 0 && valueClaim.length == 0) {
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

//Get all claims
exports.getAllClaims = async (req, res, next) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            })
            return;
        }
        let data = req.body
        let query = { isDeleted: false };
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
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
                            totalAmount: 1,
                            servicerId: 1,
                            claimType: 1,
                            getcoverOverAmount: 1,
                            customerOverAmount: 1,
                            customerClaimAmount: 1,
                            getCoverClaimAmount: 1,
                            customerStatus: 1,
                            trackingNumber: 1,
                            dealerSku: 1,
                            trackingType: 1,
                            repairParts: 1,
                            diagnosis: 1,
                            claimStatus: 1,
                            repairStatus: 1,
                            "contracts.unique_key": 1,
                            "contracts.productName": 1,
                            "contracts.model": 1,
                            "contracts.manufacture": 1,
                            "contracts.serial": 1,
                            "contracts.orders.dealerId": 1,
                            "contracts.pName": 1,
                            "contracts.orders._id": 1,
                            "contracts.orders.servicerId": 1,
                            "contracts.orders.customerId": 1,
                            "contracts.orders.resellerId": 1,
                            "contracts.orders.dealers.name": 1,
                            "contracts.orders.dealers.isServicer": 1,
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
                        { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                        { "contracts.serial": { '$regex': data.serial ? data.serial : '', '$options': 'i' } },
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
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.userId) },
                        { "contracts.orders.isDeleted": false },
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
        //Get Dealer and Reseller Servicers
        const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
        let servicer;
        allServicer = await servicerService.getAllServiceProvider(
            { _id: { $in: servicerIds }, status: true },
            {}
        );
        const result_Array = resultFiter.map((item1) => {
            servicer = []
            if (item1.contracts.orders.dealers.dealerServicer[0]?.servicerId) {
                const servicerId = item1.contracts.orders.dealers.dealerServicer[0]?.servicerId.toString()
                let foundServicer = allServicer.find(item => item._id.toString() === servicerId);
                servicer.push(foundServicer)
            }
            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }
            if (item1.contracts.orders.resellers?.isServicer) {
                servicer.unshift(item1.contracts.orders.resellers)
            }
            if (item1.contracts.orders.dealers.isServicer) {
                servicer.unshift(item1.contracts.orders.dealers)
            }
            return {
                ...item1,
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
};


exports.getDealerAsServicerClaims = async (req, res) => {
    try {
        // if (req.role != 'Super Admin') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only super admin allow to do this action'
        //     });
        //     return;
        // }
        let data = req.body
        let query = { isDeleted: false };
        let servicerIdToCheck;
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        const checkDealer = await dealerService.getDealerById(req.userId);
        if (checkDealer.isServicer) {
            let getServicerData = await servicerService.getServicerByName({ dealerId: req.userId })
            servicerIdToCheck = getServicerData._id
        }
        let servicerMatch = {}
        let dealerMatch = {}
        let dateMatch = {}
        let statusMatch = {}
        let resellerMatch = {}
        data.servicerName = data.servicerName ? data.servicerName : ""

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
        data.dealerName = data.dealerName ? data.dealerName : ""

        if (data.dealerName != "") {
            let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
            dealerMatch = { dealerId: { $in: dealerIds } }

        }
        data.resellerName = data.resellerName ? data.resellerName : ""

        if (data.resellerName != "") {
            let getReseller = await resellerService.getResellers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
            resellerMatch = { resellerId: { $in: resellerIds } }
        }

        statusMatch = {}

        if (data.dateFilter != "") {
            data.endDate = new Date(data.endDate).setHours(23, 59, 999, 0)
            if (data.dateFilter == "damageDate") {
                dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "openDate") {
                dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "closeDate") {
                dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
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
                            dealerSku: 1,
                            totalAmount: 1,
                            servicerId: 1,
                            dealerName: "$contracts.orders.dealers.name",
                            servicerName: "$servicerInfo.name",
                            servicerName: "$servicerInfo.name",
                            customerName: "$contracts.orders.customer.username",
                            customerStatus: 1,
                            getcoverOverAmount: 1,
                            customerOverAmount: 1,
                            customerClaimAmount: 1,
                            getCoverClaimAmount: 1,
                            trackingNumber: 1,
                            trackingType: 1,
                            repairParts: 1,
                            diagnosis: 1,
                            claimStatus: 1,
                            repairStatus: 1,
                            "contracts.unique_key": 1,
                            "contracts.coverageType": 1,
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
                        servicerMatch,
                        dateMatch,
                        dealerMatch,
                        statusMatch,
                        resellerMatch,
                        { servicerId: { $in: [new mongoose.Types.ObjectId(req.userId), new mongoose.Types.ObjectId(servicerIdToCheck)] } }
                    ]
                },
            },
            {
                $lookup: {
                    from: "serviceproviders",
                    localField: "servicerId",
                    foreignField: "_id",
                    as: "servicerInfo",
                }
            },
            { $unwind: { path: "$servicerInfo", preserveNullAndEmptyArrays: true } },

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
                        // { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.userId) },
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
        let allServicer
        // Iterate over the data array
        resultFiter.forEach(item => {
            // Iterate over the dealerServicer array in each item
            item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
                // Push the servicerId to the allServicerIds array
                allServicerIds.push(dealer.servicerId);
            });
        });
        const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

        //Get Dealer and Reseller Servicers
        let servicer;
        let servicerName = '';
        allServicer = await servicerService.getAllServiceProvider(
            { _id: { $in: allServicerIds }, status: true },
            {}
        );
        let result_Array = await Promise.all(resultFiter.map(async (item1) => {
            let servicer = []
            let mergedData = []
            if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
                mergedData = dynamicOption.value.filter(contract =>
                    item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
                );
            }

            let servicerName = '';
            let selfResellerServicer = false;

            let selfServicer = false;
            let customerStatusShow = false;
            await Promise.all(item1.contracts.orders.dealers.dealerServicer.map(async (matched) => {
                const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
                if (dealerOfServicer) {
                    servicer.push(dealerOfServicer);
                }
            }));


            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }
            // if (item1.contracts.orders.resellers[0]?.isServicer) {
            //     servicer.unshift(item1.contracts.orders.resellers[0])
            // }
            let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
            let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
            if (dealerResellerServicer.length > 0) {
                let dealerResellerServicer = await servicerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
                servicer = servicer.concat(dealerResellerServicer);
            }

            if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
                let checkDealerServicer = await servicerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })

                servicer.push(checkDealerServicer)
            }
            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer?._id?.toString() === item1.servicerId?.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                let checkItselfServicer = await servicerService.getServiceProviderById({ _id: item1.servicerId })
                // console.log("checkItselfServicer-------------------",checkItselfServicer)
                // console.log("dealerId-------------------",item1.contracts?.orders?.dealerId)
                selfResellerServicer = checkItselfServicer?.resellerId?.toString() === item1.contracts?.orders?.resellerId?.toString();

                selfServicer = req.role == "Customer" ? false : true
                // let getServicerDetail = await servi
                customerStatusShow = checkItselfServicer?.dealerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false

                // selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false

                // selfResellerServicer = item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString();
                // selfResellerServicer = checkItselfServicer?.resellerId?.toString() === item1.contracts?.orders?.resellerId?.toString();
                // selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false
            }
            return {
                ...item1,
                servicerData: servicerName,
                selfServicer: selfServicer,
                customerStatusShow: customerStatusShow,
                contracts: {
                    ...item1.contracts,
                    allServicer: servicer,
                    mergedData: mergedData
                }
            }
        }));


        let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
        let getTheThresholdLimit = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

        result_Array = result_Array.map(claimObject => {
            const { productValue, claimAmount } = claimObject.contracts;

            // Calculate the threshold limit value
            const thresholdLimitValue = (getTheThresholdLimit.threshHoldLimit?.value ? getTheThresholdLimit.threshHoldLimit?.value : 1000 / 100) * productValue;

            // Check if claimAmount exceeds the threshold limit value
            let overThreshold = claimAmount > thresholdLimitValue;
            let threshHoldMessage = "Claim amount exceeds the allowed limit. This might lead to claim rejection. To proceed further with claim please contact admin."
            if (!overThreshold) {
                threshHoldMessage = ""
            }
            if (!getTheThresholdLimit.isThreshHoldLimit) {
                overThreshold = false
                threshHoldMessage = ""
            }

            // Return the updated object with the new key 'overThreshold'
            return {
                ...claimObject,
                overThreshold,
                threshHoldMessage
            };
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: result_Array,
            lookupQuery,
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