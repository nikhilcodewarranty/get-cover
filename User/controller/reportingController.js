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



const REPORTING = require('../../Order/model/reporting')


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

        // // Debugging step to check the intermediate results after first grouping
        // const debugQuery = [
        //     {
        //         $match: {
        //             createdAt: { $gte: startOfMonth, $lt: endOfMonth }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
        //             total_order_amount: { $sum: "$orderAmount" },
        //             total_orders: { $sum: 1 },
        //             orders: { $push: "$$ROOT" }
        //         }
        //     }
        // ];

        // let debugResult = await REPORTING.aggregate(debugQuery);
        // console.log("Debugging Result after first $group:", JSON.stringify(debugResult[0], null, 2));

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


        // const result = getOrders.map(order => ({
        //     date: order._id,
        //     total_order_amount: order.total_order_amount,
        //     total_orders: order.total_orders,
        //     total_broker_fee: order.total_broker_fee
        // }));


        res.send({
            code: constant.successCode,
            message: "Success",
            result: result,result1,mergedResult
        })


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//weekly grouping of the data
exports.weeklySales = async (req, res) => {
    try {
        const data = req.body;

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
        while (currentDate <= endOfWeekDate) {
            datesArray.push(currentDate.clone()); // Use clone to avoid mutating currentDate
            currentDate.add(1, 'week');
        }

        // Example: Logging array of dates for debugging
        console.log("datesArray:", datesArray.map(date => date.format()));

        // MongoDB aggregation pipeline based on filterFlag
        let weeklyQuery;
        if (data.filterFlag === "All") {
            weeklyQuery = [
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
        } else if (data.filterFlag === "BrokerFee") {
            weeklyQuery = [
                {
                    $match: {
                        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                    }
                },
                {
                    $unwind: "$products" // Deconstruct the products array
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
                        total_order_amount: { $sum: "$products.brokerFee" },
                        total_orders: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 } // Sort by week start date in ascending order
                }
            ];
        } else {
            throw new Error("Invalid filterFlag provided.");
        }

        // Perform aggregation query
        const getOrders = await REPORTING.aggregate(weeklyQuery);

        // Example: Logging MongoDB aggregation results for debugging
        console.log("getOrders:", getOrders);

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

        // Send success response with result
        res.status(200).json({
            code: constant.successCode,
            message: "Success",
            result: result
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    }
};

exports.daySale = async (req, res) => {
    try {
        let data = req.body;

        // Get the current date
        const today = new Date(data.dayDate);

        // Set the start of the day
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Set the end of the day
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        let dailyQuery;
        if (data.filterFlag == "All") {
            dailyQuery = [
                {
                    $match: {
                        createdAt: { $gte: startOfDay, $lt: endOfDay }
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
            ];
        }
        if (data.filterFlag == "BrokerFee") {
            dailyQuery = [
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
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                        total_order_amount1: { $sum: "$products.brokerFee" }
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
            ];
        }

        let getOrders = await REPORTING.aggregate(dailyQuery);
        if (!getOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            });
            return;
        }

        let checkdate = new Date(data.dayDate).setDate(new Date(data.dayDate).getDate() + 1);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        const result = [{
            date: new Date(checkdate).toLocaleDateString('en-US', options),
            total_order_amount: getOrders.length ? getOrders[0].total_order_amount : 0,
            total_orders: getOrders.length ? getOrders[0].total_orders : 0
        }];

        res.send({
            code: constant.successCode,
            message: "Success",
            result: result
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    }
};


