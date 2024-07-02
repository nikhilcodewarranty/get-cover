require("dotenv").config();

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");
const moment = require('moment')

const randtoken = require('rand-token').generator()

const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const XLSX = require("xlsx");
const userResourceResponse = require("../utils/constant");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const userService = require("../services/userService");
const userMetaService = require("../services/userMetaService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const dealerService = require('../../Dealer/services/dealerService')
const servicerService = require("../../Provider/services/providerService")
const resellerService = require('../../Dealer/services/resellerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");
const fs = require('fs');
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const logs = require('../../User/model/logs');

const csvParser = require('csv-parser');
const customerService = require("../../Customer/services/customerService");
const supportingFunction = require('../../config/supportingFunction');
const orderService = require("../../Order/services/orderService");



const REPORTING = require('../../Order/model/reporting');
const { message } = require("../../Dealer/validators/register_dealer");
const claimService = require("../../Claim/services/claimService");
// daily query for reporting 

exports.dailySale = async (req, res) => {
    try {
        let data = req.body
        let query;

        // const today = new Date("2024-05-30");
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const datesArray = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            datesArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(startOfMonth, endOfMonth)
        let dailyQuery = [
            {
                $match: {
                    status: "Active",
                    updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ]
        let getOrders = await REPORTING.find();
        if (!getOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        }
        // const result = datesArray.map(date => {
        //     const dateString = date.toISOString().slice(0,10);
        //     const order = getOrders.find(item => item._id === dateString);
        //     return {
        //       date: dateString,
        //       total_order_amount: order ? order.total_order_amount : 0,
        //       total_orders: order ? order.total_orders : 0
        //     };
        //   });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: getOrders
        })


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.dailySales = async (req, res) => {
    try {
        let data = req.body
        let query;

        let startOfMonth = new Date(data.startDate);
        let endOfMonth = new Date(data.endDate);

        if (isNaN(startOfMonth) || isNaN(endOfMonth)) {
            return res.status(400).send('Invalid date format');
        }

        let datesArray = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            datesArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }


        // dates extract from the month

        // return;

        //         // const today = new Date("2024-05-30");
        //         const today = new Date();
        //         const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        //         const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        //         const datesArray = [];
        //         let currentDate = new Date(startOfMonth);
        //         while (currentDate <= endOfMonth) {
        //             datesArray.push(new Date(currentDate));
        //             currentDate.setDate(currentDate.getDate() + 1);
        //         }

        //         console.log(startOfMonth, datesArray, endOfMonth)
        // if (data.filterFlag == "All") {
        //     dailyQuery = [
        //         {
        //             $match: {
        //                 // status: "Active",
        //                 createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        //             }
        //         },
        //         {
        //             $group: {
        //                 _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
        //                 total_order_amount: { $sum: "$orderAmount" },
        //                 total_orders: { $sum: 1 }
        //             }
        //         },
        //         {
        //             $sort: { _id: -1 } // Sort by date in ascending order
        //         }
        //     ]
        // }
        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    // total_order_amount: { $sum: "$orderAmount" },
                    // total_orders: { $sum: 1 },
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];



        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            console.log("data----------------", dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
        }

        if (data.priceBookId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: data.priceBookId } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: data.priceBookId } }

            // products:

            console.log("data----------------", dailyQuery[0].$match)
        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.categoryId = { $elemMatch: { name: data.categoryId } }
            dailyQuery1[0].$match.categoryId = { $elemMatch: { name: data.categoryId } }

            // products:

            console.log("data----------------", dailyQuery[0].$match)
        }

        let getOrders = await REPORTING.aggregate(dailyQuery);
        let getOrders1 = await REPORTING.aggregate(dailyQuery1);
        if (!getOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        }

        const result = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getOrders.find(item => item._id === dateString);
            console.log("order-----------------------------------------", order)
            return {
                date: dateString,
                total_order_amount: order ? order.total_order_amount : 0,
                total_orders: order ? order.total_orders : 0,
                total_broker_fee: order ? order.total_broker_fee : 0

            };
        });

        const result1 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getOrders1.find(item => item._id === dateString);
            console.log("order-----------------------------------------", order)
            return {

                total_broker_fee: { $sum: "$products.brokerFee" },
                total_admin_fee: { $sum: "$products.adminFee" },
                total_fronting_fee: { $sum: "$products.frontingFee" },
                total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                total_retail_price: { $sum: "$products.retailPrice" },

                date: dateString,
                // total_order_amount: order ? order.total_order_amount : 0,
                // total_orders: order ? order.total_orders : 0,
                total_broker_fee: order ? order.total_broker_fee : 0,
                total_admin_fee: order ? order.total_admin_fee : 0,
                total_fronting_fee: order ? order.total_fronting_fee : 0,
                total_reserve_future_fee: order ? order.total_reserve_future_fee : 0,
                total_reinsurance_fee: order ? order.total_reinsurance_fee : 0,
                total_retail_price: order ? order.total_retail_price : 0,

            };
        });

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.date === item.date);
            return {
                ...item,
                total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                total_retail_price: match ? match.total_retail_price : item.total_retail_price,
            };
        });


        const totalFees = mergedResult.reduce((acc, curr) => {
            acc.total_broker_fee += curr.total_broker_fee || 0;
            acc.total_admin_fee += curr.total_admin_fee || 0;
            acc.total_fronting_fee += curr.total_fronting_fee || 0;
            acc.total_reserve_future_fee += curr.total_reserve_future_fee || 0;
            acc.total_reinsurance_fee += curr.total_reinsurance_fee || 0;
            return acc;
        }, {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_reinsurance_fee: 0
        });


        // const result = getOrders.map(order => ({
        //     date: order._id,
        //     total_order_amount: order.total_order_amount,
        //     total_orders: order.total_orders,
        //     total_broker_fee: order.total_broker_fee
        // }));


        res.send({
            code: constant.successCode,
            message: "Success",
            result: result, result1, mergedResult, totalFees
        })


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//weekly grouping of the data
exports.weeklySales = async (data, req, res) => {
    try {
        // const data = req.body;
        // Parse startDate and endDate from request body
        const startDate = moment(data.startDate).startOf('day');
        const endDate = moment(data.endDate).endOf('day');

        // Example: Adjusting dates with moment.js if needed
        // startDate.subtract(1, 'day');
        // endDate.add(1, 'day');
        console.log("startDate:", startDate.format(), "endDate:", endDate.format());

        // Calculate start and end of the week for the given dates
        const startOfWeekDate = moment(startDate).startOf('isoWeek');
        const endOfWeekDate = moment(endDate).endOf('isoWeek');

        // Example: Logging calculated week start and end dates

        // Create an array of dates for each week within the specified range
        const datesArray = [];
        let currentDate = moment(startOfWeekDate);
        let currentDate1 = moment(startDate);

        while (currentDate <= endOfWeekDate) {
            datesArray.push(currentDate1.clone()); // Use clone to avoid mutating currentDate
            currentDate1 = currentDate
            currentDate.add(1, 'week');
        }

        // Example: Logging array of dates for debugging
        console.log("datesArray:", datesArray.map(date => date.format()));

        // MongoDB aggregation pipeline based on filterFlag
        let weeklyQuery = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                }
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$weekStart",
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by week start date in ascending order
            }
        ];


        let weeklyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                }
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: "$weekStart",
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                    total_contracts: { $sum: "$products.noOfProducts" },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            console.log("data----------------", dealerId)
            weeklyQuery[0].$match.dealerId = dealerId
            weeklyQuery1[0].$match.dealerId = dealerId
        }

        if (data.priceBookId.length != 0) {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            weeklyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }

            // products:

        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.categoryId = data.categoryId
            weeklyQuery1[0].$match.categoryId = data.categoryId

            // products:

        }

        // Perform aggregation query
        let getOrders = await REPORTING.aggregate(weeklyQuery);
        let getOrders1 = await REPORTING.aggregate(weeklyQuery1);
        console.log("check ++++++++++++++++++++++++++++++++++++++++++++++++++++++", getOrders1)
        if (getOrders[0]) {
            getOrders[0]._id = datesArray[0]
            getOrders1[0]._id = datesArray[0]

        }

        // Example: Logging MongoDB aggregation results for debugging

        // Prepare response data based on datesArray and MongoDB results
        const result = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getOrders.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_order_amount: order ? order.total_order_amount : 0,
                total_orders: order ? order.total_orders : 0
            };
        });


        const result1 = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getOrders1.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_fronting_fee: order ? order.total_fronting_fee : 0,
                total_broker_fee: order ? order.total_broker_fee : 0,
                total_admin_fee: order ? order.total_admin_fee : 0,
                total_reserve_future_fee: order ? order.total_reserve_future_fee : 0,
                total_reinsurance_fee: order ? order.total_reinsurance_fee : 0,
                total_contracts: order ? order.total_contracts : 0,
                // total_orders: order ? order.total_orders : 0
            };
        });

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.weekStart === item.weekStart);

            const total_admin_fee = match ? match.total_admin_fee : item.total_admin_fee;
            const total_reinsurance_fee = match ? match.total_reinsurance_fee : item.total_reinsurance_fee;
            const total_reserve_future_fee = match ? match.total_reserve_future_fee : item.total_reserve_future_fee;
            const total_fronting_fee = match ? match.total_fronting_fee : item.total_fronting_fee;

            const wholesale_price = total_admin_fee + total_reinsurance_fee + total_reserve_future_fee + total_fronting_fee;

            return {
                ...item,
                total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                total_contracts: match ? match.total_contracts : item.total_contracts,
                wholesale_price: wholesale_price
            };
        });


        const totalFees = mergedResult.reduce((acc, curr) => {
            acc.total_broker_fee += curr.total_broker_fee || 0;
            acc.total_admin_fee += curr.total_admin_fee || 0;
            acc.total_fronting_fee += curr.total_fronting_fee || 0;
            acc.total_reserve_future_fee += curr.total_reserve_future_fee || 0;
            acc.total_reinsurance_fee += curr.total_reinsurance_fee || 0;
            return acc;
        }, {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_reinsurance_fee: 0
        });


        // Send success response with result
        return {
            graphData: mergedResult,
            totalFees: totalFees
        }

    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

exports.weeklySalesOrder = async (req, res) => {
    try {
        const data = req.body;
        console.log("================================", data)

        // Parse startDate and endDate from request body
        const startDate = moment(data.startDate).startOf('day');
        const endDate = moment(data.endDate).endOf('day');

        // Example: Adjusting dates with moment.js if needed
        // startDate.subtract(1, 'day');
        // endDate.add(1, 'day');

        console.log("startDate:", startDate.format(), "endDate:", endDate.format());

        // Calculate start and end of the week for the given dates
        const startOfWeekDate = moment(startDate).startOf('isoWeek');
        const endOfWeekDate = moment(endDate).endOf('isoWeek');

        // Example: Logging calculated week start and end dates
        console.log("startOfWeekDate:", startOfWeekDate.format(), "endOfWeekDate:", endOfWeekDate.format());

        // Create an array of dates for each week within the specified range
        const datesArray = [];
        let currentDate = moment(startOfWeekDate);
        let currentDate1 = moment(startDate);

        while (currentDate <= endOfWeekDate) {
            datesArray.push(currentDate.clone()); // Use clone to avoid mutating currentDate
            currentDate = currentDate
            currentDate.add(1, 'week');
        }

        // Example: Logging array of dates for debugging
        console.log("datesArray:", datesArray.map(date => date.format()));

        // MongoDB aggregation pipeline based on filterFlag
        let weeklyQuery = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                }
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$weekStart",
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by week start date in ascending order
            }
        ];

        let weeklyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                }
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: "$weekStart",
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                    total_contracts: { $sum: "$products.noOfProducts" },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            console.log("data----------------", dealerId)
            weeklyQuery[0].$match.dealerId = dealerId
            weeklyQuery1[0].$match.dealerId = dealerId
        }

        if (data.priceBookId.length != 0) {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            weeklyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }

            // products:

        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.categoryId = data.categoryId
            weeklyQuery1[0].$match.categoryId = data.categoryId

            // products:

            // console.log("data----------------", dailyQuery[0].$match)
        }

        // Perform aggregation query
        const getOrders = await REPORTING.aggregate(weeklyQuery);
        const getOrders1 = await REPORTING.aggregate(weeklyQuery1);

        // Example: Logging MongoDB aggregation results for debugging
        console.log("getOrders:", getOrders1, getOrders);

        // Prepare response data based on datesArray and MongoDB results
        const result = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getOrders.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                // total_order_amount: order ? order.total_order_amount : 0,
                total_orders: order ? order.total_orders : 0
            };
        });


        const result1 = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getOrders1.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_fronting_fee: order ? order.total_fronting_fee : 0,
                total_broker_fee: order ? order.total_broker_fee : 0,
                total_admin_fee: order ? order.total_admin_fee : 0,
                total_reserve_future_fee: order ? order.total_reserve_future_fee : 0,
                total_reinsurance_fee: order ? order.total_reinsurance_fee : 0,
                total_retail_price: order ? order.total_retail_price : 0,
                // total_orders: order ? order.total_orders : 0
            };
        });
        console.log(result, result1, "+++++++++++++++++++++++++++++")

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.weekStart === item.weekStart);

            const total_admin_fee = match ? match.total_admin_fee : item.total_admin_fee;
            const total_reinsurance_fee = match ? match.total_reinsurance_fee : item.total_reinsurance_fee;
            const total_reserve_future_fee = match ? match.total_reserve_future_fee : item.total_reserve_future_fee;
            const total_fronting_fee = match ? match.total_fronting_fee : item.total_fronting_fee;

            const wholesale_price = total_admin_fee + total_reinsurance_fee + total_reserve_future_fee + total_fronting_fee;

            return {
                ...item,
                total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                // total_retail_price: match ? match.total_retail_price : item.total_retail_price,
                wholesale_price: wholesale_price
            };
        });



        const totalFees = mergedResult.reduce((acc, curr) => {
            acc.total_broker_fee += curr.total_broker_fee || 0;
            acc.total_admin_fee += curr.total_admin_fee || 0;
            acc.total_fronting_fee += curr.total_fronting_fee || 0;
            acc.total_reserve_future_fee += curr.total_reserve_future_fee || 0;
            acc.total_reinsurance_fee += curr.total_reinsurance_fee || 0;
            return acc;
        }, {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_reinsurance_fee: 0
        });


        // Send success response with result
        return {
            graphData: result,
            // totalFees: totalFees
        }

    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

exports.daySale = async (data) => {
    try {
        // let data = req.body;

        // Get the current date
        data.dayDate = data.startDate
        const today = new Date(data.dayDate);

        // Set the start of the day
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Set the end of the day
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        console.log(startOfDay, endOfDay)

        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];

        console.log("check+++++++++++++++++++++++++++", dailyQuery[0].$match, dailyQuery[1].$group)

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay }
                }
            },
            {
                $unwind: "$products" // Deconstruct the products array
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    // total_order_amount: { $sum: "$orderAmount" },
                    // total_orders: { $sum: 1 },
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_contracts: { $sum: "$products.noOfProducts" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                }
            },
            // {
            //     $group: {
            //         _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
            //         total_order_amount: { $sum: "$orderAmount" },
            //         total_orders: { $sum: 1 }
            //     }
            // },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
        }

        if (data.priceBookId.length != 0) {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }

            // products:

        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.categoryId = data.categoryId
            dailyQuery1[0].$match.categoryId = data.categoryId

            // products:

            console.log("data----------------", dailyQuery[0].$match)
        }


        let getOrders = await REPORTING.aggregate(dailyQuery);
        let getOrders1 = await REPORTING.aggregate(dailyQuery1);
        if (!getOrders) {
            return {
                code: constant.errorCode,
                message: "Unable to fetch the details"
            }
        }

        let checkdate = new Date(data.dayDate).setDate(new Date(data.dayDate).getDate() + 0);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        let result = [{
            weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
            total_order_amount: getOrders.length ? getOrders[0].total_order_amount : 0,
            total_orders: getOrders.length ? getOrders[0].total_orders : 0
        }];

        let result1 = [{
            weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
            total_broker_fee: getOrders1.length ? getOrders1[0].total_broker_fee : 0,
            total_admin_fee: getOrders1.length ? getOrders1[0].total_admin_fee : 0,
            total_fronting_fee: getOrders1.length ? getOrders1[0].total_fronting_fee : 0,
            total_reserve_future_fee: getOrders1.length ? getOrders1[0].total_reserve_future_fee : 0,
            total_reinsurance_fee: getOrders1.length ? getOrders1[0].total_reinsurance_fee : 0,
            total_retail_price: getOrders1.length ? getOrders1[0].total_retail_price : 0,
            total_contracts: getOrders1.length ? getOrders1[0].total_contracts : 0,
        }];

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.weekStart === item.weekStart);
            const total_admin_fee = match ? match.total_admin_fee : item.total_admin_fee;
            const total_reinsurance_fee = match ? match.total_reinsurance_fee : item.total_reinsurance_fee;
            const total_reserve_future_fee = match ? match.total_reserve_future_fee : item.total_reserve_future_fee;
            const total_fronting_fee = match ? match.total_fronting_fee : item.total_fronting_fee;

            const wholesale_price = total_admin_fee + total_reinsurance_fee + total_reserve_future_fee + total_fronting_fee;

            return {
                ...item,
                total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                total_contracts: match ? match.total_contracts : item.total_contracts,
                wholesale_price: wholesale_price
            };
        });

        const totalFees = mergedResult.reduce((acc, curr) => {
            acc.total_broker_fee += curr.total_broker_fee || 0;
            acc.total_admin_fee += curr.total_admin_fee || 0;
            acc.total_fronting_fee += curr.total_fronting_fee || 0;
            acc.total_reserve_future_fee += curr.total_reserve_future_fee || 0;
            acc.total_reinsurance_fee += curr.total_reinsurance_fee || 0;
            return acc;
        }, {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_reinsurance_fee: 0
        });
        console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++', mergedResult)

        return {
            graphData: mergedResult,
            totalFees: totalFees
        }

        // res.send({
        //     code: constant.successCode,
        //     message: "Success",
        //     result: result,result1
        // });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    }
};

exports.dailySales1 = async (data, req, res) => {
    try {
        // let data = req.body
        let query;

        let startOfMonth2 = new Date(data.startDate);
        let endOfMonth1 = new Date(data.endDate);

        let startOfMonth = new Date(startOfMonth2.getFullYear(), startOfMonth2.getMonth(), startOfMonth2.getDate());



        // let startOfMonth1 = new Date(startOfMonth1.setDate(startOfMonth1.getDate()))
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
        datesArray.shift()
        console.log(datesArray, "000000000000000000000000000000")

        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_order_amount: { $sum: "$orderAmount" },
                    total_orders: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                    total_contracts: { $sum: "$products.noOfProducts" },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
        }

        if (data.priceBookId.length != 0) {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }

            // products:

        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.categoryId = data.categoryId
            dailyQuery1[0].$match.categoryId = data.categoryId

            // products:

            console.log("data----------------", dailyQuery[0].$match)
        }

        let getOrders = await REPORTING.aggregate(dailyQuery);
        let getOrders1 = await REPORTING.aggregate(dailyQuery1);
        if (!getOrders) {
            return {
                code: constant.errorCode,
                message: "Unable to fetch the details"
            }
        }

        console.log("getOrders++++++++++++++++++", getOrders, getOrders1)

        const result = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getOrders.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                total_order_amount: order ? order.total_order_amount : 0,
                total_orders: order ? order.total_orders : 0,
                total_broker_fee: order ? order.total_broker_fee : 0

            };
        });

        const result1 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getOrders1.find(item => item._id === dateString);
            return {

                total_broker_fee: { $sum: "$products.brokerFee" },
                total_admin_fee: { $sum: "$products.adminFee" },
                total_fronting_fee: { $sum: "$products.frontingFee" },
                total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                total_retail_price: { $sum: "$products.retailPrice" },
                total_contracts: { $sum: "$products.noOfProducts" },

                weekStart: dateString,
                // total_order_amount: order ? order.total_order_amount : 0,
                // total_orders: order ? order.total_orders : 0,
                total_broker_fee: order ? order.total_broker_fee : 0,
                total_admin_fee: order ? order.total_admin_fee : 0,
                total_fronting_fee: order ? order.total_fronting_fee : 0,
                total_reserve_future_fee: order ? order.total_reserve_future_fee : 0,
                total_reinsurance_fee: order ? order.total_reinsurance_fee : 0,
                total_retail_price: order ? order.total_retail_price : 0,
                total_contracts: order ? order.total_contracts : 0,

            };
        });

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.weekStart === item.weekStart);

            const total_admin_fee = match ? match.total_admin_fee : item.total_admin_fee;
            const total_reinsurance_fee = match ? match.total_reinsurance_fee : item.total_reinsurance_fee;
            const total_reserve_future_fee = match ? match.total_reserve_future_fee : item.total_reserve_future_fee;
            const total_fronting_fee = match ? match.total_fronting_fee : item.total_fronting_fee;

            const wholesale_price = total_admin_fee + total_reinsurance_fee + total_reserve_future_fee + total_fronting_fee;


            return {
                ...item,
                total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                total_contracts: match ? match.total_contracts : item.total_contracts,
                total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                // total_retail_price: match ? match.total_retail_price : item.total_retail_price,
                wholesale_price: wholesale_price
            };
        });


        const totalFees = mergedResult.reduce((acc, curr) => {
            acc.total_broker_fee += curr.total_broker_fee || 0;
            acc.total_admin_fee += curr.total_admin_fee || 0;
            acc.total_fronting_fee += curr.total_fronting_fee || 0;
            acc.total_reserve_future_fee += curr.total_reserve_future_fee || 0;
            acc.total_reinsurance_fee += curr.total_reinsurance_fee || 0;
            return acc;
        }, {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_reinsurance_fee: 0
        });



        // const result = getOrders.map(order => ({
        //     date: order._id,
        //     total_order_amount: order.total_order_amount,
        //     total_orders: order.total_orders,
        //     total_broker_fee: order.total_broker_fee
        // }));

        return {
            graphData: mergedResult,
            totalFees: totalFees
        }
        // res.send({
        //     code: constant.successCode,
        //     message: "Success",
        //     result: result,result1,mergedResult,totalFees
        // })


    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

exports.getReportingDealers = async (req, res) => {
    try {
        let data = req.body
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }, { name: 1 })
        if (!getDealers) {
            res.send({
                code: constant.successCode,
                message: "Unable to fetch the dealers"
            })
            return
        }

        res.send({
            code: constant.successCode,
            message: "Success",
            result: getDealers
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getReportingPriceBooks = async (req, res) => {
    try {
        let data = req.body
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 0, name: 1, pName: 1, coverageType: 1 })
        if (!getPriceBooks) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the price books"
            })
            return
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: getPriceBooks
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getReportingCategories = async (req, res) => {
    try {
        let data = req.body
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let categoriesId = getCategories.map(ID => ID._id)
        let getPriceBooks = await priceBookService.getAllPriceIds({ category: { $in: categoriesId } }, { name: 1, pName: 1, _id: 1, category: 1 })
        if (data.priceBookId.length != 0) {
            getPriceBooks = await priceBookService.getAllPriceIds({ category: { $in: categoriesId }, _id: { $in: data.priceBookId } }, { name: 1, pName: 1, _id: 1, category: 1 })
            let priceBookIds = getPriceBooks.map(ID => ID._id)
            let getDealerPriceBooks = await dealerPriceService.findAllDealerPrice({ priceBookId: { $in: priceBookIds } })
        }
        let dealerQuery = [
            {
                $match: {
                    status: "Approved"
                }
            },
            {
                $lookup: {
                    from: "dealerpricebooks",
                    localField: "_id",
                    foreignField: "dealerId",
                    as: "dealerPriceBooks"
                }
            }
        ]
        let getDealers = await dealerService.getDealerAndClaims(dealerQuery)

        // let getDealerPriceBooks = await dealerPriceService.findAllDealerPrice()

        // getPriceBooks = getPriceBooks.map(pricebook => {
        //     const matchedPriceBooks = getDealerPriceBooks.filter(priceBook => priceBook.priceBook.toString() === pricebook._id.toString());
        //     return {
        //         ...pricebook._doc,
        //         dealerIds: matchedPriceBooks
        //     };
        // });

        // console.log(getPriceBooks)
        if (!getCategories) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the catogories"
            })
            retrun
        }


        let result;
        // chooose conditions on filters
        if (data.dealerId != "" && data.categoryId == "" && data.priceBookId.length == 0) {
            let filteredPriceBooks = []
            let filteredCategories = []
            for (let i = 0; i < getPriceBooks.length; i++) {
                let dealers = getPriceBooks[i].dealerIds
                for (d = 0; d < dealers.length; d++) {
                    if (data.dealerId.toString() == dealers[d].dealerId.toString()) {
                        let ccc = getCategories.filter(category => category._id.toString() === getPriceBooks[i].category.toString());
                        filteredCategories.push(ccc[0])
                        console.log(ccc)
                        filteredPriceBooks.push(getPriceBooks[i])
                    }
                }
            }
            getPriceBooks = filteredPriceBooks
            const uniqueCategories = Object.values(
                filteredCategories.reduce((acc, category) => {
                    acc[category._id] = category;
                    return acc;
                }, {})
            );
            getCategories = uniqueCategories

            result = {
                getCategories, getPriceBooks, getDealers
            }
            console.log("1st condition_--------------------------------------------------")

        }
        if (data.dealerId == "" && data.categoryId == "" && data.priceBookId.length != 0) {
            console.log("2nd condition_--------------------------------------------------")

        }
        if (data.dealerId == "" && data.categoryId != "" && data.priceBookId.length == 0) {
            console.log("3rd condition_--------------------------------------------------")

        }
        if (data.dealerId != "" && data.categoryId == "" && data.priceBookId.length != 0) {
            console.log("4th condition_--------------------------------------------------")

        }
        if (data.dealerId != "" && data.categoryId != "" && data.priceBookId.length == 0) {
            console.log("5th condition_--------------------------------------------------")

        }
        if (data.dealerId == "" && data.categoryId != "" && data.priceBookId.length != 0) {
            console.log("6th condition_--------------------------------------------------")

        }
        if (data.dealerId != "" && data.categoryId != "" && data.priceBookId.length != 0) {
            console.log("7th condition_--------------------------------------------------")

        }
        if (data.dealerId == "" && data.categoryId == "" && data.priceBookId.length == 0) {
            console.log("8th condition_--------------------------------------------------")
            result = {
                getCategories, getPriceBooks, getDealers
            }
        }


        const merged = getCategories.map(category => {
            const matchedPriceBooks = getPriceBooks.filter(priceBook => priceBook.category.toString() === category._id.toString());
            return {
                ...category._doc,
                priceBooks: matchedPriceBooks
            };
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: result, merged
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getReportingDropdowns = async (req, res) => {
    try {
        let data = req.body
        let result;
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }, { name: 1 })
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 0, name: 1, pName: 1, coverageType: 1 })

        result = {
            getDealers,
            getPriceBooks,
            getCategories
        }

        if (data.dealerId != "") {
            console.log("1st condition_--------------------------------------------------")
            // let dealerPriceQuery

            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })

            result = {
                getDealers,
                getPriceBooks: getPriceBooks1,
                getCategories: getCategories1
            }

            if (data.categoryId != "") {
                let getPriceBooks2 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                result = {
                    getDealers,
                    getPriceBooks: getPriceBooks2,
                    getCategories: getCategories1
                }
            }



        }

        if (data.categoryId != "" && data.dealerId == "") {
            let getPriceBooks2 = await priceBookService.getAllPriceIds({ category: data.categoryId })
            console.log(getPriceBooks)
            result = {
                getDealers: [],
                getPriceBooks: getPriceBooks2,
                getCategories: getCategories
            }
        }



        res.send({
            code: constant.successCode,
            message: "Success",
            result: result
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.claimDailyReporting = async (data) => {
    try {
        // let data = req.body
        let startOfMonth2 = new Date(data.startDate);
        let endOfMonth1 = new Date(data.endDate);

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
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_amount: { $sum: "$totalAmount" },
                    total_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    claimPaymentStatus: "Unpaid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_unpaid_amount: { $sum: "$totalAmount" },
                    total_unpaid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery2 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    claimPaymentStatus: "Paid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },

            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_paid_amount: { $sum: "$totalAmount" },
                    total_paid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery3 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    // claimPaymentStatus: "Paid",
                    claimStatus: {
                        $elemMatch: { status: "Rejected" }
                    },
                },
            },

            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    // total_paid_amount: { $sum: "$totalAmount" },
                    total_rejected_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        console.log("sksksk+++++++++++++++", dailyQuery2[0].$match)

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = data.dealerId
            dailyQuery1[0].$match.dealerId = data.dealerId
            dailyQuery2[0].$match.dealerId = data.dealerId
            dailyQuery3[0].$match.dealerId = data.dealerId
        }

        if (data.servicerId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            let servicerId = new mongoose.Types.ObjectId(data.servicerId)

            dailyQuery[0].$match.servicerId = data.servicerId
            dailyQuery1[0].$match.servicerId = data.servicerId
            dailyQuery2[0].$match.servicerId = data.servicerId
            dailyQuery3[0].$match.servicerId = data.servicerId
        }

        // if (data.claimPaymentStatus != "") {
        //     dailyQuery[0].$match.claimPaymentStatus = data.claimPaymentStatus
        //     dailyQuery1[0].$match.claimPaymentStatus = data.claimPaymentStatus
        //     dailyQuery2[0].$match.claimPaymentStatus = data.claimPaymentStatus
        // }

        let getData = await claimService.getAllClaims(dailyQuery)
        let getData1 = await claimService.getAllClaims(dailyQuery1)
        let getData2 = await claimService.getAllClaims(dailyQuery2)
        let getData3 = await claimService.getAllClaims(dailyQuery3)
        console.log("getData3----------------------------", getData3)

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
            const order = getData1.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                total_unpaid_amount: order ? order.total_unpaid_amount : 0,
                total_unpaid_claim: order ? order.total_unpaid_claim : 0,

            };
        });

        const result2 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData2.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                total_paid_amount: order ? order.total_paid_amount : 0,
                total_paid_claim: order ? order.total_paid_claim : 0,

            };
        });

        const result3 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData3.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                // total_paid_amount: order ? order.total_paid_amount : 0,
                total_rejected_claim: order ? order.total_rejected_claim : 0,

            };
        });

        console.log(result3)

        const mergedArray = result.map(item => {
            const result1Item = result1.find(r1 => r1.weekStart === item.weekStart);
            const result2Item = result2.find(r2 => r2.weekStart === item.weekStart);
            const result3Item = result3.find(r2 => r2.weekStart === item.weekStart);

            return {
                weekStart: item.weekStart,
                total_amount: item.total_amount,
                total_claim: item.total_claim,
                total_unpaid_amount: result1Item ? result1Item.total_unpaid_amount : 0,
                total_unpaid_claim: result1Item ? result1Item.total_unpaid_claim : 0,
                total_paid_amount: result2Item ? result2Item.total_paid_amount : 0,
                total_paid_claim: result2Item ? result2Item.total_paid_claim : 0,
                total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0
            };
        });

        const totalFees = mergedArray.reduce((acc, curr) => {
            acc.total_amount += curr.total_amount || 0;
            acc.total_claim += curr.total_claim || 0;
            acc.total_unpaid_amount += curr.total_unpaid_amount || 0;
            acc.total_unpaid_claim += curr.total_unpaid_claim || 0;
            acc.total_paid_amount += curr.total_paid_amount || 0;
            acc.total_paid_claim += curr.total_paid_claim || 0;
            acc.total_rejected_claim += curr.total_rejected_claim || 0;
            return acc;
        }, {
            total_amount: 0,
            total_claim: 0,
            total_unpaid_amount: 0,
            total_unpaid_claim: 0,
            total_paid_amount: 0,
            total_paid_claim: 0,
            total_rejected_claim: 0,
        });

        return { graphData: mergedArray, totalFees }
        // return { mergedArray, result, result1, result2, totalFees }


    } catch (err) {
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
};

exports.claimWeeklyReporting = async (data) => {
    try {
        // let data = req.body
        // const data = req.body;

        // Parse startDate and endDate from request body
        const startDate = moment(data.startDate).startOf('day');
        const endDate = moment(data.endDate).endOf('day');

        // Example: Adjusting dates with moment.js if needed
        // startDate.subtract(1, 'day');
        // endDate.add(1, 'day');

        console.log("startDate:", startDate.format(), "endDate:", endDate.format());

        // Calculate start and end of the week for the given dates
        const startOfWeekDate = moment(startDate).startOf('isoWeek');
        const endOfWeekDate = moment(endDate).endOf('isoWeek');

        // Example: Logging calculated week start and end dates
        console.log("startOfWeekDate:", startOfWeekDate.format(), "endOfWeekDate:", endOfWeekDate.format());

        // Create an array of dates for each week within the specified range
        const datesArray = [];
        let currentDate = moment(startOfWeekDate);
        let currentDate1 = moment(startDate);

        while (currentDate <= endOfWeekDate) {
            datesArray.push(currentDate1.clone()); // Use clone to avoid mutating currentDate
            currentDate1 = currentDate
            currentDate.add(1, 'week');
        }


        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$weekStart",
                    total_amount: { $sum: "$totalAmount" },
                    total_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
                    claimPaymentStatus: "Unpaid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_unpaid_amount: { $sum: "$totalAmount" },
                    total_unpaid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery2 = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
                    claimPaymentStatus: "Paid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_paid_amount: { $sum: "$totalAmount" },
                    total_paid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery3 = [
            {
                $match: {
                    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
                    claimStatus: {
                        $elemMatch: { status: "Rejected" }
                    },
                },
            },
            {
                $addFields: {
                    weekStart: {
                        $dateTrunc: {
                            date: "$createdAt",
                            unit: "week",
                            binSize: 1,
                            timezone: "UTC",
                            startOfWeek: "monday"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_rejected_claim: { $sum: 1 },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let getData = await claimService.getAllClaims(dailyQuery)
        let getData1 = await claimService.getAllClaims(dailyQuery1)
        let getData2 = await claimService.getAllClaims(dailyQuery2)
        let getData3 = await claimService.getAllClaims(dailyQuery3)

        if (getData[0]) {
            getData[0]._id = datesArray[0]
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++", getData[0]._id)
        }
        if (getData1[0]) {
            getData1[0]._id = datesArray[0]
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++", datesArray[0], getData1[0]._id)
        }
        if (getData2[0]) {
            getData2[0]._id = datesArray[0]
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++", datesArray[0], getData[0]._id)
        }
        if (getData3[0]) {
            getData3[0]._id = datesArray[0]
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++", datesArray[0], getData[0]._id)
        }

        const result = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getData.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_amount: order ? order.total_amount : 0,
                total_claim: order ? order.total_claim : 0
            };
        });

        const result1 = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            // console.log("date check +++++++++++++++++++==",getData1,dateString)
            const order = getData1.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            console.log("date check +++++++++++++++++++==", getData1, datesArray)

            return {
                weekStart: dateString,
                total_unpaid_amount: order ? order.total_unpaid_amount : 0,
                total_unpaid_claim: order ? order.total_unpaid_claim : 0,

            };
        });

        const result2 = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getData2.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_paid_amount: order ? order.total_paid_amount : 0,
                total_paid_claim: order ? order.total_paid_claim : 0,

            };
        });

        const result3 = datesArray.map(date => {
            const dateString = date.format('YYYY-MM-DD');
            const order = getData3.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
            return {
                weekStart: dateString,
                total_rejected_claim: order ? order.total_rejected_claim : 0,

            };
        });

        console.log("-------------------------------------------------", result, result1, result2, getData1, getData2)


        const mergedArray = result.map(item => {
            const result1Item = result1.find(r1 => r1.weekStart === item.weekStart);
            const result2Item = result2.find(r2 => r2.weekStart === item.weekStart);
            const result3Item = result3.find(r3 => r3.weekStart === item.weekStart);

            return {
                weekStart: item.weekStart,
                total_amount: item.total_amount,
                total_claim: item.total_claim,
                total_unpaid_amount: result1Item ? result1Item.total_unpaid_amount : 0,
                total_unpaid_claim: result1Item ? result1Item.total_unpaid_claim : 0,
                total_paid_amount: result2Item ? result2Item.total_paid_amount : 0,
                total_paid_claim: result2Item ? result2Item.total_paid_claim : 0,
                total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0,
            };
        });

        const totalFees = mergedArray.reduce((acc, curr) => {
            acc.total_amount += curr.total_amount || 0;
            acc.total_claim += curr.total_claim || 0;
            acc.total_unpaid_amount += curr.total_unpaid_amount || 0;
            acc.total_unpaid_claim += curr.total_unpaid_claim || 0;
            acc.total_paid_amount += curr.total_paid_amount || 0;
            acc.total_paid_claim += curr.total_paid_claim || 0;
            acc.total_rejected_claim += curr.total_rejected_claim || 0;
            return acc;
        }, {
            total_amount: 0,
            total_claim: 0,
            total_unpaid_amount: 0,
            total_unpaid_claim: 0,
            total_paid_amount: 0,
            total_paid_claim: 0,
            total_rejected_claim: 0,
        });

        return { graphData: mergedArray, totalFees }


        // const totalFees = result.reduce((acc, curr) => {
        //     acc.total_amount += curr.total_amount || 0;
        //     acc.total_claim += curr.total_claim || 0;
        //     return acc;
        // }, {
        //     total_amount: 0,
        //     total_claim: 0,
        // });

        // return { result, totalFees }

    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

exports.claimDayReporting = async (data) => {
    try {
        data.dayDate = data.startDate
        const today = new Date(data.dayDate);

        // Set the start of the day
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Set the end of the day
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        console.log(startOfDay, endOfDay)

        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total_amount: { $sum: "$totalAmount" },
                    total_claim: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay },
                    claimPaymentStatus: "Unpaid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_unpaid_amount: { $sum: "$totalAmount" },
                    total_unpaid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];


        let dailyQuery2 = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay },
                    claimPaymentStatus: "Paid",
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_paid_amount: { $sum: "$totalAmount" },
                    total_paid_claim: { $sum: 1 },
                    // total_broker_fee: { $sum: "$products.brokerFee" }
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];


        let dailyQuery3 = [
            {
                $match: {
                    createdAt: { $gte: startOfDay, $lt: endOfDay },
                    claimStatus: {
                        $elemMatch: { status: "Rejected" }
                    },
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_rejected_claim: { $sum: 1 },
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = data.dealerId
            dailyQuery1[0].$match.dealerId = data.dealerId
            dailyQuery2[0].$match.dealerId = data.dealerId
            dailyQuery3[0].$match.dealerId = data.dealerId
        }

        if (data.servicerId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            let servicerId = new mongoose.Types.ObjectId(data.servicerId)

            dailyQuery[0].$match.servicerId = data.servicerId
            dailyQuery1[0].$match.servicerId = data.servicerId
            dailyQuery2[0].$match.servicerId = data.servicerId
            dailyQuery3[0].$match.servicerId = data.servicerId
        }

        let getData = await claimService.getAllClaims(dailyQuery)
        let getData1 = await claimService.getAllClaims(dailyQuery1)
        let getData2 = await claimService.getAllClaims(dailyQuery2)
        let getData3 = await claimService.getAllClaims(dailyQuery3)

        let checkdate = new Date(data.dayDate).setDate(new Date(data.dayDate).getDate() + 0);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        let result = [{
            weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
            total_amount: getData.length ? getData[0].total_amount : 0,
            total_claim: getData.length ? getData[0].total_claim : 0,
            total_unpaid_amount: getData1.length ? getData1[0].total_unpaid_amount : 0,
            total_unpaid_claim: getData1.length ? getData1[0].total_unpaid_claim : 0,
            total_paid_amount: getData2.length ? getData2[0].total_paid_amount : 0,
            total_paid_claim: getData2.length ? getData2[0].total_paid_claim : 0,
            total_rejected_claim: getData3.length ? getData3[0].total_rejected_claim : 0,
        }];



        const totalFees = result.reduce((acc, curr) => {
            acc.total_amount += curr.total_amount || 0;
            acc.total_claim += curr.total_claim || 0;
            return acc;
        }, {
            total_amount: 0,
            total_claim: 0,
        });

        return { result, totalFees }

    } catch (err) {
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
};

exports.claimReportinDropdown = async (req, res) => {
    try {
        let data = req.body
        let result;

        let getDealers = await dealerService.getAllDealers({ status: "Approved" })
        let getServicer = await providerService.getAllServiceProvider({ accountStatus: "Approved" })
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 0, name: 1, pName: 1, coverageType: 1 })

        result = {
            dealers: getDealers,
            servicers: getServicer,
            priceBooks:getPriceBooks,
            categories:getCategories
        }

        if (data.dealerId != "") {
            let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId })
            if (!checkDealer) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid dealer ID"
                })
                return;
            }
            let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: data.dealerId })
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
            // Get Dealer Reseller Servicer

            let dealerResellerServicer = await resellerService.getResellers({ dealerId: data.dealerId, isServicer: true })

            if (dealerResellerServicer.length > 0) {
                servicer.unshift(...dealerResellerServicer);
            }

            if (checkDealer.isServicer) {
                servicer.unshift(checkDealer);
            };

            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })


            result = {
                dealers: getDealers,
                priceBooks: getPriceBooks1,
                servicers: servicer,
                categories: getCategories1
            }


            if (data.categoryId != "") {
                let getPriceBooks2 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                result = {
                    dealers: getDealers,
                    servicers: servicer,
                    priceBooks: getPriceBooks2,
                    categories: getCategories1
                }
            }

        }
        if (data.dealerId == "" && data.servicerId != "") {
            let query = [
                {
                    $match: {
                        servicerId: new mongoose.Types.ObjectId(data.servicerId)
                    }
                },
                {
                    $lookup: {
                        from: "dealers",
                        localField: "dealerId",
                        foreignField: "_id",
                        as: "dealerData",
                        pipeline: [
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "_id",
                                    foreignField: "metaId",
                                    as: "userData",
                                    pipeline: [
                                        {
                                            $match: {
                                                isPrimary: true
                                            }
                                        }
                                    ]
                                }
                            },
                            { $unwind: "$userData" },
                        ]
                    }
                },
                {
                    $unwind: "$dealerData"
                },
            ]
            let filteredData = await dealerRelationService.getDealerRelationsAggregate(query)
            let dealerIds = filteredData.map(ID => ID._id)
            let getDealerPriceBooks = await dealerPriceService.findAllDealerPrice({ dealerId: { $in: dealerIds} })
            let priceBookIds = getDealerPriceBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })
            result = {
                dealers: filteredData,
                priceBooks: getPriceBooks1,
                servicers: getServicer,
                categories: getCategories1
            }

        }
        if (data.dealerId == "" && data.servicerId == "") {

        }
        if (data.dealerId != "" && data.servicerId != "") {

        }

        res.send({
            code: constant.successCode,
            message: "Success",
            result: result
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};