require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const orderService = require("../../Order/services/orderService")
const servicerService = require("../../Provider/services/providerService")
const claimService = require("../../Claim/services/claimService")
const contractService = require("../../Contract/services/contractService")
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const LOG = require('../../User/model/logs')

const dealerRelation = require("../../Provider/model/dealerServicer")
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const connection = require('../../db')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');
const { id } = require('../validators/register_dealer');
const { isBoolean } = require('util');
const { string } = require('joi');
const providerService = require('../../Provider/services/providerService');
const { getServicer } = require('../../Provider/controller/serviceAdminController');
const resellerService = require('../services/resellerService');


var StorageP = multer.diskStorage({
    destination: function (req, files, cb) {
        cb(null, path.join(__dirname, '../../uploads/resultFile'));
    },
    filename: function (req, files, cb) {
        cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
    }
});

var uploadP = multer({
    storage: StorageP,
}).single('file');

var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array("file", 100);

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
        const users = await dealerService.getUserByDealerId({ accountId: req.userId, isDeleted: false });

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
        console.log(dealers)
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

//price api
exports.createDealerPriceBook = async (req, res) => {
    try {
        let data = req.body
        const count = await dealerPriceService.getDealerPriceCount();
        data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
        let checkDealer = await dealerService.getDealerById(req.userId)
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
        let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: data.priceBook }, {})
        if (!checkPriceBookMain) {
            res.send({
                code: constant.errorCode,
                message: "Invalid price book ID"
            })
            return;
        }
        let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: req.userId }, {})
        if (checkPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Dealer price book already created with this product name"
            })
            return;
        }
        let createDealerPrice = await dealerPriceService.createDealerPrice(data)
        if (!createDealerPrice) {
            //Save Logs for create price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createDealerPriceBook",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to create the dealer price book"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to create the dealer price book"
            })
        } else {
            //Save Logs for create price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createDealerPriceBook",
                body: data,
                response: {
                    code: constant.successCode,
                    message: "Success",
                    result: createDealerPrice
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Success", 
                result: createDealerPrice
            })
        }
    } catch (err) {
        //Save Logs for create price book 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createDealerPriceBook catch",
            body: req.body ? req.body : { type: "Catch error" },
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

exports.getDealerPriceBookById = async (req, res) => {
    try {
        if (req.role != "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer allow to do this action"
            })
            return;
        }
        let projection = {
            _id: 1,
            name: 1,
            // wholesalePrice: {
            //   $sum: [
            //     // { $arrayElemAt: ["$priceBooks.reserveFutureFee", 0] },
            //     // { $arrayElemAt: ["$priceBooks.reinsuranceFee", 0] },
            //     // { $arrayElemAt: ["$priceBooks.adminFee", 0] },
            //     // { $arrayElemAt: ["$priceBooks.frontingFee", 0] }
            //     "$priceBooks.reserveFutureFee",
            //     "$priceBooks.reinsuranceFee",
            //     "$priceBooks.adminFee",
            //     "$priceBooks.frontingFee",
            //   ],
            // },
            "priceBook": 1,
            "dealerId": 1,
            "status": 1,
            "retailPrice": 1,
            "description": 1,
            "isDeleted": 1,
            // "brokerFee": {
            //   $subtract: ["$retailPrice","$wholesalePrice" ],
            // },
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
};

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
        let query = { isDeleted: false, status: true, dealerId: new mongoose.Types.ObjectId(req.userId) }
        console.log('skldjflksjdf', checkDealer)
        let lookupQuery
        if (checkDealer[0]?.coverageType != "Breakdown & Accidental") {
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
                                    coverageType: checkDealer[0]?.coverageType
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
        } else {
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
        }

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
        const customersId = customers.map(obj => obj._id.toString());
        const orderCustomerIds = customers.map(obj => obj._id);
        const queryUser = { accountId: { $in: customersId }, isPrimary: true };


        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

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
            const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.accountId)
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

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        result_Array = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.customerData.username) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.customerData.dealerId) &&
                phoneRegex.test(entry.phoneNumber)
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

exports.customerOrders = async (req, res) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only Dealer allow to do this action!'
            });
            return;
        }
        let data = req.body
        let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
        if (!checkCustomer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid customer ID"
            })
            return;
        }

        let ordersResult = await orderService.getAllOrders({ customerId: new mongoose.Types.ObjectId(req.params.customerId), status: { $ne: "Archieved" } }, { isDeleted: 0 })

        //Get Respective dealer
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        //Get Respective Dealers
        let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
            name: 1,
            isServicer: 1,
        });
        //Get Order Customer
        let customerIdsArray = ordersResult.map((result) => result.customerId);
        const customerCreteria = { _id: { $in: customerIdsArray } };
        let respectiveCustomer = await customerService.getAllCustomers(
            customerCreteria,
            { username: 1 }
        );
        //Get Respective Reseller

        let resellerIdsArray = ordersResult.map((result) => result.resellerId);
        const resellerCreteria = { _id: { $in: resellerIdsArray } };
        let respectiveReseller = await resellerService.getResellers(
            resellerCreteria,
            { name: 1, isServicer: 1 }
        );

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
                    servicerName: servicerName ? servicerName.toObject() : {},
                    dealerName: dealerName ? dealerName.toObject() : dealerName,
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
            message: 'Success',
            result: filteredData1
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getAllPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        //data.status = typeof (data.status) == "string" ? "all" : data.status
        console.log(data)
        let categorySearch = req.body.category ? req.body.category : ''
        let checkDealer = await dealerService.getDealerById(req.userId, { isDeleted: false });
        let queryCategories = {
            $and: [
                { isDeleted: false },
                { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
            ]
        };
        let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
        let catIdsArray = getCatIds.map(category => category._id)
        let searchName = req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : ''
        let priceType = req.body.priceType ? req.body.priceType.replace(/\s+/g, ' ').trim() : ''
        let query
        // let query ={'dealerId': new mongoose.Types.ObjectId(data.dealerId) };

        if (data.coverageType == "Breakdown & Accidental") {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.priceType': { '$regex': priceType, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'status': true },
                    { dealerId: new mongoose.Types.ObjectId(req.userId) }
                ]
            };
        } else {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.priceType': { '$regex': priceType, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'priceBooks.coverageType': checkDealer.coverageType },
                    { 'status': true },
                    { dealerId: new mongoose.Types.ObjectId(req.userId) }
                ]
            };
        }



        // Conditionally add the term query if data.term is not blank
        if (data.term) {
            query.$and.push({ 'priceBooks.term': Number(data.term) });
        }
        console.log(query)
        //
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

exports.statusUpdate = async (req, res) => {
    try {
        // Check if the user has the required role
        if (req.role !== "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer is allowed to perform this action"
            });
            return
        }

        let data = req.body;

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

        // Update the dealer price status
        const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

        if (!updatedResult) {
            //Save Logs for update price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/updateDealerPriceBook",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to update the dealer price status"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to update the dealer price status"
            });
            return;
        }
        //Save Logs for update price book
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/updateDealerPriceBook",
            body: data,
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
        //Save Logs for update price book
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/updateDealerPriceBook catch",
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
        return
    }
};

exports.getResellerPriceBook = async (req, res) => {
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
            {
                dealerId: new mongoose.Types.ObjectId(checkDealer._id)
            },
            {
                isDeleted: false
            }
        ]
    }
    //  let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(checkDealer._id), status: true }
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
    const queryUser = { accountId: { $in: checkReseller._id } }
    let users = await userService.getMembers(queryUser, { isDeleted: 0 });
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
            //servicer = await providerService.getAllServiceProvider({ resellerId: checkReseller._id }, { isDeleted: 0 })
            servicer.unshift(checkReseller);
        }

        const servicerIds = servicer.map(obj => obj._id);

        const query1 = { accountId: { $in: servicerIds }, isPrimary: true };
        let servicerUser = await userService.getMembers(query1, {})
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        result_Array = servicer.map(servicer => {
            const matchingItem = servicerUser.find(user => user.accountId.toString() === servicer._id.toString())
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: servicer.toObject()
                };
            } else {
                return servicer.toObject();
            }
        })

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
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



    // result_Array = servicerUser.map(item1 => {
    //     const matchingItem = servicer.find(item2 => item2._id.toString() === item1.accountId.toString());

    //     if (matchingItem) {
    //         return {
    //             ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
    //             servicerData: matchingItem.toObject()
    //         };
    //     } else {
    //         return servicerUser.toObject();
    //     }
    // });





}

// exports.getDealerServicers = async (req, res) => {
//     try {
//         let data = req.body

//         let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
//         if (!checkDealer) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Invalid dealer ID"
//             })
//             return;
//         }
//         let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.userId })
//         if (!getServicersIds) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the servicer"
//             })
//             return;
//         }
//         let ids = getServicersIds.map((item) => item.servicerId)
//         let servicer = await providerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
//         if (!servicer) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the servicers"
//             })
//             return;
//         }
//         if (checkDealer.isServicer) {
//             servicer.unshift(checkDealer);
//         }

//         const servicerIds = servicer.map(obj => obj._id);
//         const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

//         let servicerUser = await userService.getMembers(query1, {})
//         if (!servicerUser) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the data"
//             });
//             return;
//         };

//         const result_Array = servicer.map(item1 => {
//             const matchingItem = servicerUser.find(item2 => item2.accountId.toString() === item1._id.toString());
//             if (matchingItem) {
//                 return {
//                     ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
//                     servicerData: item1.toObject()
//                 };
//             } else {
//                 return {servicerData: {} }
//             }
//         });

//         for (let i = 0; i < result_Array.length; i++) {
//             const servicerId = result_Array[i].servicerData?._id;
//             let getServicerFromDealer = await servicerService.getAllServiceProvider({ dealerId: { $in: servicerId } })
//             console.log("claim check+++++++4444444444444++++++++++++++")

//             // Aggregate pipeline to join orders, contracts, and claims
//             var aggregateResult = await orderService.getAllOrders1([
//                 {
//                     $match: {
//                         $and: [
//                             {
//                                 $or: [
//                                     { servicerId: new mongoose.Types.ObjectId(servicerId) },
//                                     { servicerId: new mongoose.Types.ObjectId(getServicerFromDealer[0]?._id) },
//                                 ]
//                             },
//                             { dealerId: new mongoose.Types.ObjectId(req.params.dealerId) },
//                         ]
//                     }
//                 },
//                 {
//                     $lookup: {
//                         from: "contracts",
//                         localField: "_id",
//                         foreignField: "orderId",
//                         as: "contracts"
//                     }
//                 },
//                 { $unwind: "$contracts" },
//                 {
//                     $lookup: {
//                         from: "claims",
//                         localField: "contracts._id",
//                         foreignField: "contractId",
//                         as: "claims",
//                         // pipeline: [
//                         //   {
//                         //     $match: { claimFile: { $in: ["Open", "Completed"] } }
//                         //   }
//                         // ]
//                     }
//                 },
//                 {
//                     $project: {
//                         'claims': { $arrayElemAt: ["$claims", 0] },
//                         _id: 0,
//                         servicerId: 1
//                     }
//                 }
//             ]);
//             console.log("hhhhhhhhhhhhhhhhhhh++++++++++++++++")

//             // If there are results for the current servicerId, update the result array
//             aggregateResult = aggregateResult.filter(obj => Object.keys(obj).length !== 1);
//             console.log("claim check+++++++++++++++++++++")
//             let totalClaimAmount = 0

//             function calculateTotalAmountAndCount(arr) {
//                 let total = 0;
//                 let count = aggregateResult.length;
//                 for (let obj of arr) {
//                     total += obj.claims.totalAmount;
//                 }
//                 return { totalAmount: total, totalCount: count };
//             }
//             const { totalAmount, totalCount } = calculateTotalAmountAndCount(aggregateResult);
//             console.log("Total amount:", totalAmount);
//             console.log("Total count:", totalCount);

//             result_Array[i].claimCount = totalCount;
//             result_Array[i].totalClaimAmount = totalAmount;

//         }

//         const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
//         const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
//         const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

//         const filteredData = result_Array.filter(entry => {
//             return (
//                 nameRegex.test(entry.servicerData?.name) &&
//                 emailRegex.test(entry.email) &&
//                 phoneRegex.test(entry.phoneNumber)
//             );
//         });

//         res.send({
//             code: constant.successCode,
//             message: "Success",
//             result: filteredData
//         });

//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message
//         })
//     }
// };


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
        console.log("-------------------------------------------------------", 1)
        let ids = getServicersIds.map((item) => item.servicerId)
        let servicer = await servicerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        //res.json(servicer);return;
        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        };

        //res.json(servicer);return;
        let servicerIds = []

        servicer.forEach(obj => {
            if (obj.dealerId != null) {
                servicerIds.push(obj.dealerId);
            }
            else if (obj.resellerId != null) {
                servicerIds.push(obj.resellerId);
            }
            else {
                servicerIds.push(obj._id);
            }
            // dealerIds.push(obj.dealerId);
            // resellerIds.push(obj.resellerId);
        });
        // const servicerIds = servicer.map(obj => obj._id);
        // const dealerIds = servicer.map(obj => obj.dealerId);
        // const resellerIds = servicer.map(obj => obj.resellerId);

        //res.json(resellerIds);return;




        // const matchServicer = {
        //   $or: [
        //     { accountId: { $in: servicerIds }, isPrimary: true },
        //     { accountId: { $in: dealerIds }, isPrimary: true },
        //     { accountId: { $in: resellerIds }, isPrimary: true }
        //   ]
        // }
        const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

        //  res.json(query1);
        //  return;

        let servicerUser = await userService.getMembers(query1, {});

        // res.json(servicerUser);return;

        //res.json(servicerUser); return;
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        const result_Array = servicer.map(item1 => {
            const matchingItem = servicerUser.find(item2 => item2.accountId?.toString() === item1?._id.toString() || item2.accountId?.toString() === item1?.dealerId?.toString() || item2.accountId?.toString() === item1?.resellerId?.toString());
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: item1.toObject()
                };
            }
            else {
                return {
                    servicerData: {}
                };
            }
        });
        // console.log("-------------------------------------------------------result_Array",result_Array)
        // console.log("-------------------------------------------------------",5)


        for (let i = 0; i < result_Array.length; i++) {
            const servicerId = result_Array[i].servicerData?._id;
            let getServicerFromDealer = await servicerService.getAllServiceProvider({ dealerId: { $in: servicerId } })
            console.log("claim check+++++++4444444444444++++++++++++++")

            // Aggregate pipeline to join orders, contracts, and claims
            var aggregateResult = await orderService.getAllOrders1([
                {
                    $match: {
                        $and: [
                            {
                                $or: [
                                    { servicerId: new mongoose.Types.ObjectId(servicerId) },
                                    { servicerId: new mongoose.Types.ObjectId(getServicerFromDealer[0]?._id) },
                                ]
                            },
                            { dealerId: new mongoose.Types.ObjectId(req.params.dealerId) },
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "contracts",
                        localField: "_id",
                        foreignField: "orderId",
                        as: "contracts"
                    }
                },
                { $unwind: "$contracts" },
                {
                    $lookup: {
                        from: "claims",
                        localField: "contracts._id",
                        foreignField: "contractId",
                        as: "claims",
                        // pipeline: [
                        //   {
                        //     $match: { claimFile: { $in: ["Open", "Completed"] } }
                        //   }
                        // ]
                    }
                },
                {
                    $project: {
                        'claims': { $arrayElemAt: ["$claims", 0] },
                        _id: 0,
                        servicerId: 1
                    }
                }
            ]);
            console.log("hhhhhhhhhhhhhhhhhhh++++++++++++++++")

            // If there are results for the current servicerId, update the result array
            aggregateResult = aggregateResult.filter(obj => Object.keys(obj).length !== 1);


            console.log("claim check+++++++++++++++++++++", aggregateResult)
            let totalClaimAmount = 0

            function calculateTotalAmountAndCount(arr) {
                let total = 0;
                let count = aggregateResult.length;
                for (let obj of arr) {
                    total += obj.claims.totalAmount;
                }
                return { totalAmount: total, totalCount: count };
            }
            const { totalAmount, totalCount } = calculateTotalAmountAndCount(aggregateResult);
            console.log("Total amount:", totalAmount);
            console.log("Total count:", totalCount);

            result_Array[i].claimCount = totalCount;
            result_Array[i].totalClaimAmount = totalAmount;

        }

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')



        let filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData?.name) &&
                emailRegex.test(entry?.email) &&
                phoneRegex.test(entry?.phoneNumber)
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

        console.log("filteredData----------------------------------------", filteredData)


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

exports.getServicersList = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false, accountStatus: "Approved", status: true, dealerId: null, resellerId: null }
        let projection = { __v: 0, isDeleted: 0 }
        let servicer = await providerService.getAllServiceProvider(query, projection);


        let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.userId })

        const resultArray = servicer.map(item => {
            const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
            const documentData = item._doc;
            return { ...documentData, check: !!matchingServicer };
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: resultArray
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.createDeleteRelation = async (req, res) => {
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

        const trueArray = [];
        const falseArray = [];

        data.servicers.forEach(item => {
            if (item.status || item.status == "true") {
                trueArray.push(item);
            } else {
                falseArray.push(item);
            }
        });

        console.log('asdfadf++++++++++', trueArray, falseArray)

        let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
        let checkId = trueArray.map(record => record._id)
        const existingRecords = await dealerRelationService.getDealerRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: checkId }
        });

        // Step 2: Separate existing and non-existing servicer IDs
        const existingServicerIds = existingRecords.map(record => record.servicerId.toString());

        const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));

        console.log(')))))))))))))))))', existingRecords, existingServicerIds, checkId, newServicerIds)
        // Step 3: Delete existing records
        let deleteData = await dealerRelationService.deleteRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: uncheckId }
        });
        console.log('***************************', deleteData)
        // return res.json(deleteData)
        // Step 4: Insert new records
        const newRecords = newServicerIds.map(servicerId => ({
            dealerId: req.userId,
            servicerId: servicerId
        }));
        if (newRecords.length > 0) {
            let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
            res.send({
                code: constant.successCode,
                message: "successw"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "success"
            })
        }






        // for (let i = 0; i < data.servicers.length; i++) {
        //   let servicer = data.servicers[i]
        //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.userId })
        //   if (!checkRelation) {
        //     console.log('new------------')

        //   } else {
        //     console.log('delete------------')

        //   }
        // }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//customers api
exports.createCustomer = async (req, res, next) => {
    try {
        let data = req.body;
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        let getCount = await customerService.getCustomersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer ID
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        // check reseller valid or not
        if (data.resellerName && data.resellerName != "") {
            var checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
            if (!checkReseller) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid Reseller."
                })
                return;
            }
        }

        // check customer acccount name 
        let checkAccountName = await customerService.getCustomerByName({
            username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: req.userId
        });
        // if (checkAccountName) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Customer already exist with this account name"
        //     })
        //     return;
        // };

        let checkCustomerEmail = await userService.findOneUser({ email: data.email });
        if (checkCustomerEmail) {
            res.send({
                code: constant.errorCode,
                message: "Primary user email already exist"
            })
            return;
        }

        let customerObject = {
            username: data.accountName,
            street: data.street,
            city: data.city,
            dealerId: checkDealer._id,
            //isAccountCreate: data?.isAccountCreate ? data.isAccountCreate : data.status,
            isAccountCreate: !checkDealer.userAccount ? false : data.status,
            resellerId: checkReseller ? checkReseller._id : null,
            zip: data.zip,
            state: data.state,
            country: data.country,
            status: data.status,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }

        let teamMembers = data.members
        let emailsToCheck = teamMembers.map(member => member.email);
        let queryEmails = { email: { $in: emailsToCheck } };
        let checkEmails = await customerService.getAllCustomers(queryEmails, {});
        if (checkEmails.length > 0) {
            res.send({
                code: constant.errorCode,
                message: "Some email ids already exist"
            })
        }
        const createdCustomer = await customerService.createCustomer(customerObject);
        if (!createdCustomer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the customer"
            })
            return;
        };
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, status: !data.status ? false : member.status, metaId: createdCustomer._id, roleId: '656f080e1eb1acda244af8c7' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)
        res.send({
            code: constant.successCode,
            message: "Customer created successfully",
            result: data
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

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
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id.toString());

        const customersOrderId = customers.map(obj => obj._id);
        const queryUser = { accountId: { $in: customersId }, isPrimary: true };


        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
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

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id?.toString() === item1.accountId?.toString());
            const order = ordersData.find(order => order._id?.toString() === item1.accountId?.toString())
            console.log("order===================", item1._id)
            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem.toObject(),
                    order: order ? order : {}
                };
            } else {
                return dealerData.toObject();
            }
        });
        let name = data.firstName ? data.firstName : ""
        let nameArray = name.split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };
        console.log('name check ++++++++++++++++++++++=', newObj)
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name.replace(/\s+/g, ' ').trim() : '', 'i')
        const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.customerData.username) &&
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
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

exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        if (data.resellerId != "") {
            query = { dealerId: req.userId, resellerId: data.resellerId };
        } else {
            query = { dealerId: req.userId };
        }
        let getCustomers = await customerService.getAllCustomers(query, {});
        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers",
            });
            return;
        }
        console.log(" getCustomers --------------", getCustomers)
        const customerIds = getCustomers.map(customer => customer?._id.toString());
        let query1 = { accountId: { $in: customerIds }, isPrimary: true };
        let projection = { __v: 0, isDeleted: 0 }

        let customerUser = await userService.getMembers(query1, projection)

        const result_Array = customerUser.map(item1 => {
            const matchingItem = getCustomers.find(item2 => item2._id?.toString() === item1.accountId?.toString());
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(),
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

// exports.getServicerInOrders = async (req, res) => {
//     let data = req.body;
//     let servicer = [];
//     if (req.userId) {
//         var checkDealer = await dealerService.getDealerById(req.userId, {
//             isDeleted: 0,
//         });
//         if (!checkDealer) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Dealer not found!",
//             });
//             return;
//         }
//         let getServicersIds = await dealerRelationService.getDealerRelations({
//             dealerId: req.userId,
//         });
//         // if (!getServicersIds) {
//         //     res.send({
//         //         code: constant.errorCode,
//         //         message: "Unable to fetch the servicer"
//         //     })
//         //     return;
//         // }
//         let ids = getServicersIds.map((item) => item.servicerId);
//         servicer = await servicerService.getAllServiceProvider(
//             { _id: { $in: ids }, status: true },
//             {}
//         );
//         if (!servicer) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the servicers",
//             });
//             return;
//         }
//     }
//     if (data.resellerId) {
//         var checkReseller = await resellerService.getReseller({
//             _id: data.resellerId,
//         });
//         // if (!checkReseller) {
//         //     res.send({
//         //         code: constant.errorCode,
//         //         message: "Invalid Reseller ID"
//         //     })
//         //     return;
//         // }
//     }
//     if (checkReseller && checkReseller.isServicer) {
//         servicer.unshift(checkReseller);
//     }

//     if (checkDealer && checkDealer.isServicer) {
//         servicer.unshift(checkDealer);
//     }

//     const servicerIds = servicer.map((obj) => obj._id);
//     const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

//     let servicerUser = await userService.getMembers(query1, {});
//     if (!servicerUser) {
//         res.send({
//             code: constant.errorCode,
//             message: "Unable to fetch the data",
//         });
//         return;
//     }

//     const result_Array = servicer.map((item1) => {
//         const matchingItem = servicerUser.find(
//             (item2) => item2.accountId?.toString() === item1._id?.toString()
//         );

//         if (matchingItem) {
//             return {
//                 ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
//                 servicerData: matchingItem.toObject(),
//             };
//         } else {
//             return {};
//         }
//     });

//     res.send({
//         code: constant.successCode,
//         result: result_Array,
//     });
// };





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
    const resellerIdss = servicer.map((obj) => obj?.resellerId);
    const dealerIdss = servicer.map((obj) => obj?.dealerId);
    // const dealerIdss = servicer.map((obj) => obj?._id);
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

    console.log('hceck', servicer, servicerUser)

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
//dealers api
exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        let getCount = await resellerService.getResellersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId, accountStatus: true }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: req.userId }, {})
        if (checkName) {
            res.send({
                code: constant.errorCode,
                message: "Reseller already exist with this account name"
            })
            return;
        };

        let checkCustomerEmail = await userService.findOneUser({ email: data.email });
        if (checkCustomerEmail) {
            res.send({
                code: constant.errorCode,
                message: "Primary user email already exist"
            })
            return;
        }
        let isAccountCreate = data.status
        let resellerObject = {
            name: data.accountName,
            street: data.street,
            isAccountCreate: isAccountCreate,
            city: data.city,
            dealerId: checkDealer._id,
            zip: data.zip,
            state: data.state,
            country: data.country,
            isServicer: data.isServicer ? data.isServicer : false,
            status: true,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }

        let teamMembers = data.members
        // let emailsToCheck = teamMembers.map(member => member.email);
        // let queryEmails = { email: { $in: emailsToCheck } };
        // let checkEmails = await customerService.getAllCustomers(queryEmails, {});
        // if (checkEmails.length > 0) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Some email ids already exist"
        //     })
        // }
        const createdReseler = await resellerService.createReseller(resellerObject);
        if (!createdReseler) {
            //Save Logs for create reseller 
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createReseller",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to create the reseller"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to create the reseller"
            })
            return;
        };
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdReseler._id, metaId: createdReseler._id, roleId: '65bb94b4b68e5a4a62a0b563' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)

        if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
                name: data.accountName,
                street: data.street,
                city: data.city,
                zip: data.zip,
                resellerId: createdReseler._id,
                state: data.state,
                country: data.country,
                status: true,
                accountStatus: "Approved",
                unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
        }
        //Save Logs for create reseller 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createReseller",
            body: data,
            response: {
                code: constant.successCode,
                message: "Reseller created successfully",
                result: createdReseler
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.successCode,
            message: "Reseller created successfully",
            result: data
        })


    } catch (err) {
        //Save Logs for create reseller 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createReseller catch",
            body: req.body ? req.body : { type: "catch error" },
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

exports.getResellerOrders = async (req, res) => {
    try {
        // if (req.role != 'Dealer') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only dealer allow to do this action!'

        //     })
        //     return;
        // }
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
                street: 1
            }
        );
        let customerIdsArray = ordersResult.map((result) => result.customerId);

        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId?.toString());
        const customerCreteria = { _id: { $in: customerIdsArray } };

        const allUserIds = mergedArray.concat(userCustomerIds);

        // console.log("allUserIds==============",allUserIds);

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

        // const updatedArray = filteredData.map((item) => ({
        //     ...item,
        //     servicerName: item.dealerName.isServicer 
        //         ? item.dealerName
        //         : item.resellerName.isServicer
        //             ? item.resellerName
        //             : item.servicerName
        //         username:getPrimaryUser.find(user=>user.accountId.toString()===item.dealerName._id.toString())
        // }));

        const updatedArray = filteredData.map(item => {
            let username = null; // Initialize username as null
            if (item.dealerName) {
                username = getPrimaryUser.find(user => user.accountId?.toString() === item.dealerName._id?.toString());
            }
            if (item.resellerName) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.resellerName._id?.toString()) : {};
            }
            if (item.customerName) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.customerName._id?.toString()) : {};
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

exports.getDealerResellers = async (req, res) => {
    try {
        // if (req.role != 'Dealer') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only dealer allow to do this action!'
        //     });
        //     return;
        // }
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
        const resellerId = resellers.map(obj => obj._id.toString());
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

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
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.accountId.toString())
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

exports.getDealerResellersInOrder = async (req, res) => {
    try {
        // if (req.role != 'Dealer') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only dealer allow to do this action!'
        //     });
        //     return;
        // }
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
        const resellerId = resellers.map(obj => obj._id.toString());
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

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
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.accountId.toString())
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
            let userDealerIds = ordersResult.map((result) => result.dealerId?.toString());
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
                    street: 1
                }
            );
            let customerIdsArray = ordersResult.map((result) => result?.customerId);

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

// exports.getAllContracts = async (req, res) => {
//     try {
//         if (req.role != 'Dealer') {
//             res.send({
//                 code: constant.errorCode,
//                 message: 'Only dealer allow to do this action!'
//             });
//             return;
//         }
//         let data = req.body
//         let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//         let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//         let limitData = Number(pageLimit)
//         let newQuery = [];
//         if (data.customerName) {
//             newQuery.push(
//                 {
//                     $lookup: {
//                         from: "customers",
//                         localField: "order.customerId",
//                         foreignField: "_id",
//                         as: "order.customer"
//                     }
//                 },
//                 {
//                     $match: {
//                         $and: [
//                             { "order.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         ]
//                     },
//                 }
//             );
//         }
//         data.servicerName = data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : ''
//         if (data.servicerName) {
//             data.servicerName = data.servicerName.toString().replace(/\s+/g, ' ').trim()
//             console.log("Servicer name----------------", data.servicerName);
//             newQuery.push(
//                 {
//                     $lookup: {
//                         from: "serviceproviders",
//                         localField: "order.servicerId",
//                         foreignField: "_id",
//                         as: "order.servicer"
//                     }
//                 },
//                 {
//                     $match: {
//                         $and: [
//                             { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.toString().replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         ]
//                     },
//                 }
//             );
//         }
//         data.resellerName = data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : ''
//         // data.resellerName = data.resellerName.replace(/\s+/g, ' ').trim()
//         if (data.resellerName) {
//             newQuery.push(
//                 {
//                     $lookup: {
//                         from: "resellers",
//                         localField: "order.resellerId",
//                         foreignField: "_id",
//                         as: "order.reseller"
//                     }
//                 },
//                 {
//                     $match: {
//                         $and: [
//                             { "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         ]
//                     },
//                 }
//             );
//         }
//         newQuery.push(
//             {
//                 $facet: {
//                     totalRecords: [
//                         {
//                             $count: "total"
//                         }
//                     ],
//                     data: [
//                         {
//                             $lookup: {
//                                 from: "resellers",
//                                 localField: "order.resellerId",
//                                 foreignField: "_id",
//                                 as: "order.reseller",
//                             }
//                         },
//                         {
//                             $skip: skipLimit
//                         },
//                         {
//                             $limit: pageLimit
//                         },
//                         {
//                             $project: {
//                                 productName: 1,
//                                 model: 1,
//                                 serial: 1,
//                                 unique_key: 1,
//                                 status: 1,
//                                 manufacture: 1,
//                                 eligibilty: 1,
//                                 // "order.unique_key": 1,
//                                 // "order.venderOrder": 1
//                                 order_unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                 order_venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                 order: {
//                                   unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                   venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                 },
//                                 totalRecords: 1
//                             }
//                         }
//                     ],
//                 },
//             })

//         let contractFilter = []
//         if (data.eligibilty != '') {
//             contractFilter = [
//                 // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { eligibilty: data.eligibilty === "true" ? true : false },
//             ]
//         } else {
//             contractFilter = [
//                 // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//         }

//         let query = [
//             { $sort: { unique_key_number: -1 } },
//             {
//                 $match:
//                 {
//                     $and: contractFilter
//                 },
//             },
//             {
//                 $lookup: {
//                     from: "orders",
//                     localField: "orderId",
//                     foreignField: "_id",
//                     as: "order",
//                 }
//             },
//             // {
//             //     $unwind: {
//             //         path: "$order",
//             //         preserveNullAndEmptyArrays: true,
//             //     }
//             // },
//             {
//                 $match:
//                 {
//                     $and: [
//                         { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         // { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
//                         { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         { "order.dealerId": new mongoose.Types.ObjectId(req.userId) }
//                     ]
//                 },

//             }

//         ]

//         if (newQuery.length > 0) {
//             query = query.concat(newQuery);
//         }

//         let getContracts = await contractService.getAllContracts2(query)
//         let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0
//         let getTotalCount = await contractService.findContractCount({ isDeleted: false })
//         res.send({
//             code: constant.successCode,
//             message: "Success",
//             result: getContracts[0]?.data ? getContracts[0]?.data : [],
//             totalCount
//         })

//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message
//         })
//     }
// };

exports.getAllContracts = async (req, res) => {
    try {
        let data = req.body
        console.log("data------------------", data)
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
            let getData = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
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
        let orderAndCondition = []
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })
        }
        if (req.role == 'Dealer') {
            userSearchCheck = 1
            orderAndCondition.push({ dealerId: { $in: [req.userId] } })
        };

        console.log("orderAndCondition-------------------", orderAndCondition)
        let orderIds = []
        if (orderAndCondition.length > 0) {
            let getOrders = await orderService.getOrders({
                $and: orderAndCondition
            })
            if (getOrders.length > 0) {
                orderIds = await getOrders.map(order => order._id)
            }
        }
        console.log("getOrders-------------------", orderIds)
        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
            console.log('check_--------dssssssssssssssssssssss--------')
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
                                unique_key: 1,
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


        // console.log("sssssss", contractFilterWithPaging)

        let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

        res.send({
            code: constant.successCode,
            message: "Success",
            result: getContracts[0]?.data ? getContracts[0]?.data : [],
            totalCount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

// exports.getCategoryAndPriceBooks = async (req, res) => {
//     try {
//         let data = req.body;
//         if (!data.coverageType) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Coverage type is required"
//             });
//             return;
//         }
//         //check dealer id to get price book
//         let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
//             dealerId: req.userId,
//             status: true,
//         });
//         if (!getDealerPriceBook) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the data",
//             });
//             return;
//         }
//         // price book ids array from dealer price book
//         let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
//         let query

//         if (data.coverageType == "Breakdown & Accidental") {
//             query = { status: true, _id: { $in: dealerPriceIds } }
//         } else {
//             query = {
//                 $and: [
//                     { status: true },
//                     { _id: { $in: dealerPriceIds } },
//                     { coverageType: data.coverageType }
//                 ]
//             }
//         }
//         // if(data.priceCatId){
//         //     let categories =
//         //     query = { _id: { $in: dealerPriceIds } ,}
//         // }



//         let getPriceBooks = await priceBookService.getAllPriceIds(query, {});
//         const dealerPriceBookMap = new Map(
//             getDealerPriceBook.map((item) => [
//                 item.priceBook.toString(),
//                 item.retailPrice,
//             ])
//         );

//         // Update getPriceBook array with retailPrice from getDealerPriceBook
//         let mergedPriceBooks = getPriceBooks.map((item) => {
//             const retailPrice = dealerPriceBookMap.get(item._id.toString()) || 0;
//             return {
//                 ...item._doc,
//                 retailPrice,
//             };
//         });


//         //unique categories IDs from price books
//         let uniqueCategory = {};
//         let uniqueCategories = getPriceBooks.filter((item) => {
//             if (!uniqueCategory[item.category.toString()]) {
//                 uniqueCategory[item.category.toString()] = true;
//                 return true;
//             }
//             return false;
//         });

//         uniqueCategories = uniqueCategories.map((item) => item.category);

//         // get categories related to dealers
//         let getCategories = await priceBookService.getAllPriceCat(
//             { _id: { $in: uniqueCategories } },
//             {}
//         );

//         // gettign selected category if user select the price book first
//         let filteredPiceBook;
//         let checkSelectedCategory;
//         let dealerPriceBookDetail = {
//             _id: "",
//             priceBook: "",
//             dealerId: "",
//             status: "",
//             retailPrice: "",
//             description: "",
//             isDeleted: "",
//             brokerFee: "",
//             unique_key: "",
//             wholesalePrice: "",
//             __v: 0,
//             createdAt: "",
//             updatedAt: "",
//         };
//         if (data.priceBookId || data.priceBookId != "") {
//             filteredPiceBook = getPriceBooks
//                 .filter((item) => item._id.toString() === data.priceBookId)
//                 .map((item) => item.category);
//             checkSelectedCategory = await priceBookService.getPriceCatByName({
//                 _id: filteredPiceBook,
//             });

//             dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({
//                 dealerId: req.params.dealerId ? req.params.dealerId : req.userId,
//                 priceBook: data.priceBookId,
//             });
//         }

//         if (data.priceCatId || data.priceCatId != "") {
//             mergedPriceBooks = mergedPriceBooks.filter(
//                 (item) => item.category.toString() === data.priceCatId
//             );
//             checkSelectedCategory = await priceBookService.getPriceCatByName({
//                 _id: filteredPiceBook,
//             });

//             // dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: req.params.dealerId, priceBook: data.priceBookId })
//         }

//         let result = {
//             priceCategories: getCategories,
//             priceBooks: mergedPriceBooks,
//             selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
//             dealerPriceBookDetail: dealerPriceBookDetail,
//         };



//         res.send({
//             code: constant.successCode,
//             message: "Success",
//             result: result,
//         });
//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message,
//         });
//     }
// };

exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body;
        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
            dealerId:  req.userId,
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
        if (data.priceBookId || data.priceBookId != "") {
            let getPriceBooks = await priceBookService.getAllPriceIds({ _id: data.priceBookId }, {});
            data.term = getPriceBooks[0]?.term ? getPriceBooks[0].term : ""
            data.pName = getPriceBooks[0]?.pName ? getPriceBooks[0].pName : ""
        }
        let query;
        // if (data.coverageType == "Breakdown & Accidental") {
        //     if (data.term != "" && data.pName == "") {
        //         query = { _id: { $in: dealerPriceIds }, status: true, term: data.term };
        //     }
        //     else if (data.pName != "" && data.term == "") {
        //         query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName };

        //     } else if (data.term != "" && data.pName != "") {
        //         query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term };
        //     } else {
        //         query = { _id: { $in: dealerPriceIds }, status: true, };
        //     }
        // } else {
            if (data.term != "" && data.pName == "") {
                query = { _id: { $in: dealerPriceIds }, status: true, term: data.term };
            }
            else if (data.pName != "" && data.term == "") {
                query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName };

            } else if (data.term != "" && data.pName != "") {
                query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term };
            } else {
                query = { _id: { $in: dealerPriceIds }, coverageType: data.coverageType, status: true, };
            }

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

        const uniqueTerms = [...new Set(mergedPriceBooks.map(item => item.term))].map(term => ({
            label: Number(term) / 12 === 1 ? Number(term) / 12 + " Year" : Number(term) / 12  + " Years",
            value: term
        })).sort((a, b) => a.value - b.value)

        const uniqueProductName = [...new Set(mergedPriceBooks.map(item => item?.pName))].map(pName => ({
            pName: pName,
        }));

        let result = {
            priceCategories: getCategories,
            priceBooks: data.priceCatId == "" ? [] : mergedPriceBooks,
            productName: data.priceCatId == "" ? [] : uniqueProductName,
            terms: data.priceCatId == "" ? [] : uniqueTerms,
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


exports.createOrder = async (req, res) => {
    try {
        // upload(req, res, async (err) => {
        let data = req.body;
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        //console.log("bodyData=================",data)
        // for (let i = 0; i < data.productsArray.length; i++) {
        // if (data.productsArray[i].QuantityPricing) {

        //         let jsonArray = JSON.parse(data.productsArray[i].QuantityPricing[0]);
        //        // let jsonFile = JSON.parse(data.productsArray[i].orderFile);
        //         data.productsArray[i].QuantityPricing = jsonArray;
        //        // data.productsArray[i].file = jsonFile;
        //     }
        // }

        data.resellerId = data.resellerId == 'null' ? null : data.resellerId;
        data.venderOrder = data.dealerPurchaseOrder;
        let projection = { isDeleted: 0 };

        var checkDealer = await dealerService.getDealerById(
            req.userId,
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
        data.dealerId = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;
        let count = await orderService.getOrdersCount();
        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + "2024" + data.unique_key_number
        data.unique_key = "GC-" + "2024-" + data.unique_key_number

        let checkVenderOrder = await orderService.getOrder(
            { venderOrder: data.dealerPurchaseOrder, dealerId: req.userId },
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
                billTo: "Dealer",
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
                billTo: "Dealer",
                detail: {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address

                }
            }
        }
        let savedResponse = await orderService.addOrder(data);

        // Update Term and condtion while create order
        let uploadTermAndCondtion = await orderService.updateOrder(
            { _id: savedResponse._id },
            { termCondition: checkDealer?.termCondition },
            { new: true }
        );
        if (!savedResponse) {
            //Save Logs for create order
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createOrder",
                body: data,
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

        //Save Logs for create order
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createOrder",
            body: data,
            response: {
                code: constant.successCode,
                message: 'Success!'
            }
        }
        await LOG(logData).save()

        res.send({
            code: constant.successCode,
            message: 'Success!'
        })

    } catch (err) {
        //Save Logs for create order
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createOrder catch",
            body: req.body ? req.body : { type: "Catch error" },
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

        if (checkId.status == "Active" || checkId.status == "Archieved") {
            res.send({
                code: constant.errorCode,
                message: "Unable to edit the order, please refersh the page",
            });
            return;
        }

        if (req.userId.toString() != checkId.dealerId.toString()) {
            let checkDealer = await dealerService.getDealerById(
                req.userId
            );
            if (!checkDealer) {
                res.send({
                    code: constant.errorCode,
                    message: "Dealer not found",
                });
                return;
            }
        }

        if (data.servicerId != "") {
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
        }
        if (data.customerId != "") {
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
        }
        if (checkId.status == 'Archieved') {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived!",
            });
            return;
        }
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
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

        if (checkId.paymentStatus != "Unpaid") {
            if (Number(data.orderAmount) > Number(checkId.orderAmount)) {
                data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
                data.paymentStatus = "PartlyPaid"
            }
            if (Number(data.orderAmount) < Number(checkId.orderAmount)) {
                let checkDue = Number(data.orderAmount) - Number(checkId.paidAmount)
                if (checkDue <= 0) {
                    data.dueAmount = 0
                    data.paymentStatus = "Paid"
                } else {
                    data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
                    data.paymentStatus = "PartlyPaid"
                }

            }
        }

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
                let coverageStartDate = product.coverageStartDate;
                let coverageEndDate = product.coverageEndDate;
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
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                // let savedDataOrder = savedResponse.toObject()

                totalDataComing.forEach((data, index) => {
                    let unique_key_number1 = count1[0] ? count1[0].unique_key_number + index + 1 : 100000
                    let unique_key_search1 = "OC" + "2024" + unique_key_number1
                    let unique_key1 = "OC-" + "2024-" + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate) < new Date() ? "Active" : "Waiting"
                    claimStatus = new Date(product.coverageEndDate) < new Date() ? "Expired" : claimStatus
                    // let dateCheck = new Date(product.coverageStartDate)
                    // dateCheck.setDate(product.coverageStartDate + product.adh ? product.adh : 0)
                    // let eligibilty = new Date(dateCheck) < new Date() ? true : false


                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh : 0)
                    let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                    let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                    dateCheck = dateCheck.setDate(dateCheck.getDate() + adhDays)
                    // console.log("The minimum date is:",data);

                    let partsWarrantyDate = new Date(new Date(data.purchaseDate).setDate(new Date(data.purchaseDate).getMonth() + partWarrantyMonth))
                    let labourWarrantyDate = new Date(new Date(data.purchaseDate).setDate(new Date(data.purchaseDate).getMonth() + labourWarrantyMonth))
                    function findMinDate(d1, d2, d3) {
                        return new Date(Math.min(d1.getTime(), d2.getTime(), d3.getTime()));
                    }

                    // Find the minimum date
                    let minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));

                    console.log("The minimum date is:", new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate), minDate);
                    // let eligibilty = new Date(dateCheck) < new Date() ? true : false
                    console.log("minDateAll Dateiiiiiiiiiiiiiiiiiiiiiiiiiiiiii", minDate)
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false

                    // let eligibilty = claimStatus == "Active" ? true : false

                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        pName: priceBook[0]?.pName,
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: data.partsWarranty,
                        labourWarranty: data.labourWarranty,
                        purchaseDate: data.purchaseDate,
                        serial: data.serial,
                        orderUniqueKey: savedResponse.unique_key,
                        venderOrder: savedResponse.venderOrder,
                        coverageStartDate: coverageStartDate,
                        coverageEndDate: coverageEndDate,
                        status: claimStatus,
                        eligibilty: eligibilty,
                        productValue: data.retailValue,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };
                    contractArray.push(contractObject);
                    //let saveData = contractService.createContract(contractObject)
                });

                let createContract = await contractService.createBulkContracts(contractArray);
                if (!createContract) {
                    if (!saveContracts) {
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
                }
                if (createContract) {
                    res.send({
                        code: constant.successCode,
                        message: "Success",
                    });
                }

            })
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
        const claimQuery = { claimFile: 'Completed' }
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
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
        let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

        const rejectedQuery = { claimFile: { $ne: "Rejected" } }
        //Get number of claims
        let numberOfCompleletedClaims = [
            {
                $match: rejectedQuery
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
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                        { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.userId) },
                    ]
                },
            },
        ]
        let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
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
                // result: {
                //     "_id": "",
                //     "totalAmount": 0,
                //     "totalOrder": 0
                // }
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

exports.addClaim = async (req, res, next) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            });
            return;
        }
        let data = req.body;
        let checkContract = await contractService.getContractById({ _id: data.contractId })

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
        if (new Date(checkContract.coverageStartDate) > new Date(data.lossDate)) {
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
        let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'Open' })
        if (checkClaim) {
            res.send({
                code: constant.errorCode,
                message: 'The previous claim is still open!'
            });
            return
        }
        const query = { contractId: new mongoose.Types.ObjectId(data.contractId) }
        let claimTotal = await claimService.checkTotalAmount(query);
        if (checkContract.productValue < claimTotal[0]?.amount) {
            res.send({
                code: consta.errorCode,
                message: 'Claim Amount Exceeds Contract Retail Price'
            });
            return;
        }
        data.receiptImage = data.file
        data.servicerId = data.servicerId ? data.servicerId : null
        let count = await claimService.getClaimCount();

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "CC" + "2024" + data.unique_key_number
        data.unique_key = "CC-" + "2024-" + data.unique_key_number
        let claimResponse = await claimService.createClaim(data)
        if (!claimResponse) {
            res.send({
                code: constant.errorCode,
                message: 'Unable to add claim of this contract!'
            });
            return
        }
        // Eligibility false when claim open
        const updateContract = await contractService.updateContract({ _id: data.contractId }, { eligibilty: false }, { new: true })
        res.send({
            code: constant.successCode,
            message: 'Success!',
            result: claimResponse
        })


    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        })
    }
};

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
        console.log(req.userId);
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let newQuery = [];
        // if (data.orderId) {
        //   newQuery.push({
        //     $lookup: {
        //       from: "orders",
        //       localField: "contracts.orderId",
        //       foreignField: "_id",
        //       as: "contracts.orders",
        //       pipeline: [
        //         // {
        //         //   $match:
        //         //   {
        //         //     $and: [
        //         //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //         //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //         //       { isDeleted: false },
        //         //     ]
        //         //   },
        //         // },

        //         // {
        //         //   $lookup: {
        //         //     from: "dealers",
        //         //     localField: "dealerId",
        //         //     foreignField: "_id",
        //         //     as: "dealers",
        //         //     pipeline: [
        //         //       // {
        //         //       //   $match:
        //         //       //   {
        //         //       //     $and: [
        //         //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
        //         //       //       { isDeleted: false },
        //         //       //     ]
        //         //       //   },
        //         //       // },
        //         //       {
        //         //         $lookup: {
        //         //           from: "servicer_dealer_relations",
        //         //           localField: "_id",
        //         //           foreignField: "dealerId",
        //         //           as: "dealerServicer",
        //         //         }
        //         //       },
        //         //     ]
        //         //   }
        //         // },
        //         // {
        //         //   $unwind: "$dealers"
        //         // },
        //         // {
        //         //   $lookup: {
        //         //     from: "resellers",
        //         //     localField: "resellerId",
        //         //     foreignField: "_id",
        //         //     as: "resellers",
        //         //   }
        //         // },
        //         // {
        //         //   $lookup: {
        //         //     from: "serviceproviders",
        //         //     localField: "servicerId",
        //         //     foreignField: "_id",
        //         //     as: "servicers",
        //         //   }
        //         // },

        //       ]
        //     },

        //   },
        //     {
        //       $unwind: "$contracts.orders"
        //     },
        //     {
        //       $match:
        //       {
        //         $and: [
        //           // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //           { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
        //           { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //           { "contracts.orders.isDeleted": false },
        //         ]
        //       },
        //     })
        // }
        // if (data.dealerName) {
        //   if (data.orderId) {
        //     newQuery.push(
        //       {
        //         $lookup: {
        //           from: "dealers",
        //           localField: "contracts.orders.dealerId",
        //           foreignField: "_id",
        //           as: "contracts.orders.dealers",
        //           pipeline: [
        //             // {
        //             //   $match:
        //             //   {
        //             //     $and: [
        //             //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
        //             //       { isDeleted: false },
        //             //     ]
        //             //   },
        //             // },
        //             // {
        //             //   $lookup: {
        //             //     from: "servicer_dealer_relations",
        //             //     localField: "_id",
        //             //     foreignField: "dealerId",
        //             //     as: "dealerServicer",
        //             //   }
        //             // },
        //           ]
        //         }
        //       },
        //       {
        //         $unwind: "$contracts.orders.dealers"
        //       },
        //       {
        //         $match:
        //         {
        //           "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
        //           // "contracts.orders.dealers.isDeleted": false,
        //         }

        //       },
        //     );
        //   }
        //   else {
        //     newQuery.push(
        //       {
        //         $lookup: {
        //           from: "orders",
        //           localField: "contracts.orderId",
        //           foreignField: "_id",
        //           as: "contracts.orders",
        //           pipeline: [
        //             // {
        //             //   $match:
        //             //   {
        //             //     $and: [
        //             //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //             //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //             //       { isDeleted: false },
        //             //     ]
        //             //   },
        //             // },

        //             // {
        //             //   $lookup: {
        //             //     from: "dealers",
        //             //     localField: "dealerId",
        //             //     foreignField: "_id",
        //             //     as: "dealers",
        //             //     pipeline: [
        //             //       // {
        //             //       //   $match:
        //             //       //   {
        //             //       //     $and: [
        //             //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
        //             //       //       { isDeleted: false },
        //             //       //     ]
        //             //       //   },
        //             //       // },
        //             //       {
        //             //         $lookup: {
        //             //           from: "servicer_dealer_relations",
        //             //           localField: "_id",
        //             //           foreignField: "dealerId",
        //             //           as: "dealerServicer",
        //             //         }
        //             //       },
        //             //     ]
        //             //   }
        //             // },
        //             // {
        //             //   $unwind: "$dealers"
        //             // },
        //             // {
        //             //   $lookup: {
        //             //     from: "resellers",
        //             //     localField: "resellerId",
        //             //     foreignField: "_id",
        //             //     as: "resellers",
        //             //   }
        //             // },
        //             // {
        //             //   $lookup: {
        //             //     from: "serviceproviders",
        //             //     localField: "servicerId",
        //             //     foreignField: "_id",
        //             //     as: "servicers",
        //             //   }
        //             // },

        //           ]
        //         },

        //       },
        //       {
        //         $unwind: "$contracts.orders"
        //       },
        //       {
        //         $match:
        //         {
        //           $and: [
        //             // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //             { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
        //             { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //             { "contracts.orders.isDeleted": false },
        //           ]
        //         },
        //       },
        //       {
        //         $lookup: {
        //           from: "dealers",
        //           localField: "contracts.orders.dealerId",
        //           foreignField: "_id",
        //           as: "contracts.orders.dealers",
        //           pipeline: [
        //             // {
        //             //   $match:
        //             //   {
        //             //     $and: [
        //             //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
        //             //       { isDeleted: false },
        //             //     ]
        //             //   },
        //             // },
        //             // {
        //             //   $lookup: {
        //             //     from: "servicer_dealer_relations",
        //             //     localField: "_id",
        //             //     foreignField: "dealerId",
        //             //     as: "dealerServicer",
        //             //   }
        //             // },
        //           ]
        //         }
        //       },
        //       {
        //         $unwind: "$contracts.orders.dealers"
        //       },
        //       {
        //         $match:
        //         {
        //           "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
        //           // "contracts.orders.dealers.isDeleted": false,
        //         }

        //       },
        //     )
        //   }
        // }

        // if (data.customerName) {
        //   if (data.orderId) {
        //     newQuery.push(
        //       {
        //         $lookup: {
        //           from: "customers",
        //           localField: "contracts.orders.customerId",
        //           foreignField: "_id",
        //           as: "contracts.orders.customer",
        //           // pipeline: [

        //           // ]
        //         }
        //       },
        //       {
        //         $unwind: "$contracts.orders.customer"
        //       },
        //       {
        //         $match:
        //         {
        //           $and: [
        //             { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
        //             { "contracts.orders.customer.isDeleted": false },
        //           ]
        //         },
        //       },
        //     );
        //   }
        //   else {
        //     newQuery.push({
        //       $lookup: {
        //         from: "orders",
        //         localField: "contracts.orderId",
        //         foreignField: "_id",
        //         as: "contracts.orders",
        //         pipeline: [
        //           // {
        //           //   $match:
        //           //   {
        //           //     $and: [
        //           //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //           //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //           //       { isDeleted: false },
        //           //     ]
        //           //   },
        //           // },

        //           // {
        //           //   $lookup: {
        //           //     from: "dealers",
        //           //     localField: "dealerId",
        //           //     foreignField: "_id",
        //           //     as: "dealers",
        //           //     pipeline: [
        //           //       // {
        //           //       //   $match:
        //           //       //   {
        //           //       //     $and: [
        //           //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
        //           //       //       { isDeleted: false },
        //           //       //     ]
        //           //       //   },
        //           //       // },
        //           //       {
        //           //         $lookup: {
        //           //           from: "servicer_dealer_relations",
        //           //           localField: "_id",
        //           //           foreignField: "dealerId",
        //           //           as: "dealerServicer",
        //           //         }
        //           //       },
        //           //     ]
        //           //   }
        //           // },
        //           // {
        //           //   $unwind: "$dealers"
        //           // },
        //           // {
        //           //   $lookup: {
        //           //     from: "resellers",
        //           //     localField: "resellerId",
        //           //     foreignField: "_id",
        //           //     as: "resellers",
        //           //   }
        //           // },
        //           // {
        //           //   $lookup: {
        //           //     from: "serviceproviders",
        //           //     localField: "servicerId",
        //           //     foreignField: "_id",
        //           //     as: "servicers",
        //           //   }
        //           // },

        //         ]
        //       },

        //     },
        //       {
        //         $unwind: "$contracts.orders"
        //       },
        //       {
        //         $match:
        //         {
        //           $and: [
        //             // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //             { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
        //             { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
        //             { "contracts.orders.isDeleted": false },
        //           ]
        //         },
        //       },

        //       {
        //         $lookup: {
        //           from: "customers",
        //           localField: "contracts.orders.customerId",
        //           foreignField: "_id",
        //           as: "contracts.orders.customer",
        //           // pipeline: [

        //           // ]
        //         }
        //       },
        //       {
        //         $unwind: "$contracts.orders.customer"
        //       },
        //       {
        //         $match:
        //         {
        //           $and: [
        //             { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
        //             { "contracts.orders.customer.isDeleted": false },
        //           ]
        //         },
        //       },

        //     )
        //   }
        // }
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
                            customerStatus: 1,
                            trackingNumber: 1,
                            trackingType: 1,
                            repairParts: 1,
                            diagnosis: 1,
                            claimStatus: 1,
                            repairStatus: 1,
                            // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
                            "contracts.unique_key": 1,
                            "contracts.productName": 1,
                            "contracts.model": 1,
                            "contracts.manufacture": 1,
                            "contracts.serial": 1,
                            "contracts.orders.dealerId": 1,
                            "contracts.orders._id": 1,
                            "contracts.orders.servicerId": 1,
                            "contracts.orders.customerId": 1,
                            "contracts.orders.resellerId": 1,
                            "contracts.orders.dealers.name": 1,
                            "contracts.orders.dealers.isServicer": 1,
                            "contracts.orders.customer.username": 1,
                            // "contracts.orders.dealers.dealerServicer": 1,
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
                    // {
                    //   $addFields: {
                    //     lastRepairStatus: { $arrayElemAt: ["$repairStatus", -1] }
                    //   }
                    // },
                ]
            }
        })
        let lookupQuery = [
            { $sort: { unique_key_number: -1 } },
            {
                $match:
                {
                    $and: [
                        // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
                        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        // { isDeleted: false },
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
                        // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
                        { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.serial": { '$regex': data.serial ? data.serial : '', '$options': 'i' } },
                        { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        // { "contracts.isDeleted": false },
                    ]
                },
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "contracts.orderId",
                    foreignField: "_id",
                    as: "contracts.orders",
                    pipeline: [
                        // {
                        //   $match:
                        //   {
                        //     $and: [
                        //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
                        //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
                        //       { isDeleted: false },
                        //     ]
                        //   },
                        // },

                        // {
                        //   $lookup: {
                        //     from: "dealers",
                        //     localField: "dealerId",
                        //     foreignField: "_id",
                        //     as: "dealers",
                        //     pipeline: [
                        //       // {
                        //       //   $match:
                        //       //   {
                        //       //     $and: [
                        //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
                        //       //       { isDeleted: false },
                        //       //     ]
                        //       //   },
                        //       // },
                        //       {
                        //         $lookup: {
                        //           from: "servicer_dealer_relations",
                        //           localField: "_id",
                        //           foreignField: "dealerId",
                        //           as: "dealerServicer",
                        //         }
                        //       },
                        //     ]
                        //   }
                        // },
                        // {
                        //   $unwind: "$dealers"
                        // },
                        // {
                        //   $lookup: {
                        //     from: "resellers",
                        //     localField: "resellerId",
                        //     foreignField: "_id",
                        //     as: "resellers",
                        //   }
                        // },
                        // {
                        //   $lookup: {
                        //     from: "serviceproviders",
                        //     localField: "servicerId",
                        //     foreignField: "_id",
                        //     as: "servicers",
                        //   }
                        // },

                    ]
                },

            },
            {
                $unwind: "$contracts.orders"
            },
            {
                $match:
                {
                    $and: [
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
                        // { "contracts.orders.customer.isDeleted": false },
                    ]
                },
            },

        ]
        if (newQuery.length > 0) {
            lookupQuery = lookupQuery.concat(newQuery);
        }
        let allClaims = await claimService.getAllClaims(lookupQuery);

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

        // console.log("servicer====================",servicer);return;

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
















