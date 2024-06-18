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
exports.dailySales = async (req, res) => {
    try {
        let data = req.body
        let query;

        // const today = new Date("2024-05-30");
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const datesArray = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            datesArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(startOfMonth, datesArray, endOfMonth)
        let dailyQuery
        if (data.filterFlag == "All") {
            dailyQuery = [
                {
                    $match: {
                        // status: "Active",
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
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
        }
        if (data.filterFlag == "BrokerFee") {
            dailyQuery = [
                {
                    $match: {
                        // status: "Active",
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                {
                    $unwind: "$products" // Deconstruct the products array
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                        total_order_amount1: { $sum: "$products.brokerFee" },
                        //   total_orders: { $sum: 1 }
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
        }

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            console.log("data----------------", dealerId)
            dailyQuery[0].$match.dealerId = dealerId
        }

        if (data.priceBookId != "") {
            // let priceBookId = new mongoose.Types.ObjectId(data.priceBookId)
            dailyQuery[0].$match.products = { $elemMatch: { name: data.priceBookId } }

            // products:

            console.log("data----------------", dailyQuery[0].$match)
        }

        console.log("ckkkkkkk")
        // res.send({
        //     code: constant.errorCode,
        //     message: dailyQuery
        // })
        // return;

        let getOrders = await REPORTING.aggregate(dailyQuery);
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
            return {
                date: dateString,
                total_order_amount: order ? order.total_order_amount : 0,
                total_orders: order ? order.total_orders : 0
            };
        });
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


