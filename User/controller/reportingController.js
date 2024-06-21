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
const dealerService = require('../../Dealer/services/dealerService')
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
}

//daily data 
//daily data 
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
}

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

        if (data.priceBookId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.products = { $elemMatch: { name: data.priceBookId } }
            weeklyQuery1[0].$match.products = { $elemMatch: { name: data.priceBookId } }

            // console.log("data----------------", weeklyQuery[0].$match)
        }

        if (data.categoryId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            weeklyQuery[0].$match.categoryId = { $elemMatch: { name: data.categoryId } }
            weeklyQuery1[0].$match.categoryId = { $elemMatch: { name: data.categoryId } }

            // products:

            console.log("data----------------", weeklyQuery[0].$match)
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
                total_retail_price: order ? order.total_retail_price : 0,
                // total_orders: order ? order.total_orders : 0
            };
        });
        console.log(result,result1,"+++++++++++++++++++++++++++++")

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
            graphData: mergedResult,
            totalFees: totalFees
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

        if (data.priceBookId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: data.priceBookId } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: data.priceBookId } }

            // products:

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

        if (data.priceBookId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: data.priceBookId } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: data.priceBookId } }

            // products:

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
            return {
                code: constant.errorCode,
                message: "Unable to fetch the details"
            }
        }

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

                weekStart: dateString,
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
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1 })
        if (!getCategories) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the catogories"
            })
            retrun
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: getCategories
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.claimReporting = async (req, res) => {
    try {
        let data = req.body

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}