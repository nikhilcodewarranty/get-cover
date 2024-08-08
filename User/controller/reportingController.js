require("dotenv").config();
const moment = require('moment')
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const dealerService = require('../../Dealer/services/dealerService')
const servicerService = require("../../Provider/services/providerService")
const resellerService = require('../../Dealer/services/resellerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const role = require("../model/role");
const constant = require('../../config/constant');
const mail = require("@sendgrid/mail");
const logs = require('../../User/model/logs');
const orderService = require("../../Order/services/orderService");
const REPORTING = require('../../Order/model/reporting');
const { message } = require("../../Dealer/validators/register_dealer");
const claimService = require("../../Claim/services/claimService");


//weekly grouping of the data
exports.weeklySales = async (data, req, res) => {
    try {
        // Parse startDate and endDate from request body
        const startDate = moment(data.startDate).startOf('day');
        const endDate = moment(data.endDate).endOf('day');
        // Calculate start and end of the week for the given dates
        const startOfWeekDate = moment(startDate).startOf('isoWeek');
        const endOfWeekDate = moment(endDate).endOf('isoWeek');
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
            weeklyQuery[0].$match.dealerId = dealerId
            weeklyQuery1[0].$match.dealerId = dealerId
        }

        if (data.categoryId != "") {
            weeklyQuery[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }
            weeklyQuery1[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }
        }

        if (data.priceBookId.length != 0) {
            weeklyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            weeklyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
        }

        if (data.orderId) {
            dailyQuery[0].$match.orderId = { $in: data.orderId }
            dailyQuery1[0].$match.orderId = { $in: data.orderId }
        }
        // Perform aggregation query
        let getOrders = await REPORTING.aggregate(weeklyQuery);
        let getOrders1 = await REPORTING.aggregate(weeklyQuery1);
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
            };
        });

        const mergedResult = result.map(item => {
            const match = result1.find(r1 => r1.weekStart === item.weekStart);
            const total_admin_fee = match ? match.total_admin_fee : item.total_admin_fee;
            const total_reinsurance_fee = match ? match.total_reinsurance_fee : item.total_reinsurance_fee;
            const total_reserve_future_fee = match ? match.total_reserve_future_fee : item.total_reserve_future_fee;
            const total_fronting_fee = match ? match.total_fronting_fee : item.total_fronting_fee;
            const wholesale_price = total_admin_fee + total_reinsurance_fee + total_reserve_future_fee + total_fronting_fee;
            if (data.role == 'Super Admin') {
                return {
                    ...item,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    // total_broker_fee1: match ? match.total_broker_fee : item.total_broker_fee,
                    total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                    total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                    total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Dealer') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    total_broker_fee1: match ? match.total_broker_fee : item.total_broker_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Reseller') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                };
            }
            if (data.role == 'Customer') {
                return {
                    total_order_amount: item.total_order_amount
                };

            }
        });
        let totalFees = []

        if (data.role == 'Super Admin') {
            totalFees = mergedResult.reduce((acc, curr) => {
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
        }
        // Send success response with result
        return {
            graphData: mergedResult,
            totalFees: totalFees
        }

    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

//Get daily sale
exports.daySale = async (data) => {
    try {
        // Get the current date
        data.dayDate = data.startDate
        const today = new Date(data.dayDate);
        // Set the start of the day
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        // Set the end of the day
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
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
                    total_broker_fee: { $sum: "$products.brokerFee" },
                    total_admin_fee: { $sum: "$products.adminFee" },
                    total_fronting_fee: { $sum: "$products.frontingFee" },
                    total_reserve_future_fee: { $sum: "$products.reserveFutureFee" },
                    total_reinsurance_fee: { $sum: "$products.reinsuranceFee" },
                    total_contracts: { $sum: "$products.noOfProducts" },
                    total_retail_price: { $sum: "$products.retailPrice" },
                }
            },
            {
                $sort: { _id: -1 } // Sort by date in ascending order
            }
        ];
        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
        }
        if (data.orderId) {
            dailyQuery[0].$match.orderId = { $in: data.orderId }
            dailyQuery1[0].$match.orderId = { $in: data.orderId }
        }
        if (data.categoryId != "") {
            dailyQuery[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }
            dailyQuery1[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }

        }
        if (data.priceBookId.length != 0) {
            dailyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
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
            total_broker_fee1: getOrders1.length ? getOrders1[0].total_broker_fee : 0,
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

            if (data.role == 'Super Admin') {
                return {
                    ...item,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                    total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                    total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Dealer') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    total_broker_fee1: match ? match.total_broker_fee : item.total_broker_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Reseller') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                };
            }
            if (data.role == 'Customer') {
                return {
                    total_order_amount: item.total_order_amount
                };

            }
        });

        let totalFees = []
        if (data.role == 'Super Admin') {
            totalFees = mergedResult.reduce((acc, curr) => {
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
        }

        return {
            graphData: mergedResult,
            totalFees: totalFees
        }

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        });
    }
};

//Get daily sales1
exports.dailySales1 = async (data, req, res) => {
    try {
        let query;
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
        datesArray.shift()

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
        if (data.orderId) {
            dailyQuery[0].$match.orderId = { $in: data.orderId }
            dailyQuery1[0].$match.orderId = { $in: data.orderId }
        }
        if (data.categoryId != "") {
            dailyQuery[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }
            dailyQuery1[0].$match.products = { $elemMatch: { categoryId: data.categoryId } }
        }
        if (data.priceBookId.length != 0) {
            dailyQuery[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
            dailyQuery1[0].$match.products = { $elemMatch: { name: { $in: data.priceBookId } } }
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
                total_contracts: { $sum: "$products.noOfProducts" },
                weekStart: dateString,
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

            if (data.role == 'Super Admin') {
                return {
                    ...item,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    // total_broker_fee1: match ? match.total_broker_fee : item.total_broker_fee,
                    total_admin_fee: match ? match.total_admin_fee : item.total_admin_fee,
                    total_fronting_fee: match ? match.total_fronting_fee : item.total_fronting_fee,
                    total_reserve_future_fee: match ? match.total_reserve_future_fee : item.total_reserve_future_fee,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_reinsurance_fee: match ? match.total_reinsurance_fee : item.total_reinsurance_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Dealer') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                    total_broker_fee: match ? match.total_broker_fee : item.total_broker_fee,
                    total_broker_fee1: match ? match.total_broker_fee : item.total_broker_fee,
                    wholesale_price: wholesale_price
                };
            }
            if (data.role == 'Reseller') {
                return {
                    ...item,
                    total_contracts: match ? match.total_contracts : item.total_contracts,
                };
            }
            if (data.role == 'Customer') {
                return {
                    total_order_amount: item.total_order_amount
                };
            }
        });

        let totalFees = []
        if (data.role == 'Super Admin') {
            totalFees = mergedResult.reduce((acc, curr) => {
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
        }

        return {
            graphData: mergedResult,
            totalFees: totalFees
        }

    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

//Get claim reporting
exports.claimDailyReporting = async (data) => {
    try {
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
                    claimStatus: {
                        $elemMatch: { status: "Rejected" }
                    },
                },
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

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
            dailyQuery2[0].$match.dealerId = dealerId
            dailyQuery3[0].$match.dealerId = dealerId
        }
        if (data.servicerId != "") {
            let servicerId = new mongoose.Types.ObjectId(data.servicerId)
            dailyQuery[0].$match.servicerId = servicerId
            dailyQuery1[0].$match.servicerId = servicerId
            dailyQuery2[0].$match.servicerId = servicerId
            dailyQuery3[0].$match.servicerId = servicerId
        }
        if (data.customerId) {
            let servicerId = new mongoose.Types.ObjectId(data.customerId)
            dailyQuery[0].$match.customerId = data.customerId
            dailyQuery1[0].$match.customerId = data.customerId
            dailyQuery2[0].$match.customerId = data.customerId
            dailyQuery3[0].$match.customerId = data.customerId
        }
        if (data.priceBookId.length != 0) {
            let getOrders = await orderService.getOrders({ productsArray: { $elemMatch: { priceBookId: { $in: data.priceBookId } } } })
            if (!getOrders) {
                return {
                    code: constant.errorCode,
                    message: "Invalid price book ID"
                }

            }
            let orderIds = getOrders.map(ID => ID.unique_key)
            dailyQuery[0].$match.orderId = { $in: orderIds }
            dailyQuery1[0].$match.orderId = { $in: orderIds }
            dailyQuery2[0].$match.orderId = { $in: orderIds }
            dailyQuery3[0].$match.orderId = { $in: orderIds }
        }


        let getData = await claimService.getClaimWithAggregate(dailyQuery)
        let getData1 = await claimService.getClaimWithAggregate(dailyQuery1)
        let getData2 = await claimService.getClaimWithAggregate(dailyQuery2)
        let getData3 = await claimService.getClaimWithAggregate(dailyQuery3)

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
                total_rejected_claim: order ? order.total_rejected_claim : 0,

            };
        });

        const mergedArray = result.map(item => {
            const result1Item = result1.find(r1 => r1.weekStart === item.weekStart);
            const result2Item = result2.find(r2 => r2.weekStart === item.weekStart);
            const result3Item = result3.find(r2 => r2.weekStart === item.weekStart);

            if (data.role == 'Super Admin') {
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
            }
            if (data.role == 'Dealer') {
                if (data.isServicer) {
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
                } else {
                    return {
                        weekStart: item.weekStart,
                        total_amount: item.total_amount,
                        total_claim: item.total_claim,
                        total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0
                    };
                }
            }
            if (data.role == 'Reseller') {
                if (data.isServicer) {
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
                } else {
                    return {
                        weekStart: item.weekStart,
                        total_amount: item.total_amount,
                        total_claim: item.total_claim,
                        total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0
                    };
                }
            }
            if (data.role == 'Customer') {
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
            }
            if (data.role == "Servicer") {
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
            }
        });

        let totalFees = []
        if (data.role = "Super Admin") {
            totalFees = mergedArray.reduce((acc, curr) => {
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
        }
        return { graphData: mergedArray, totalFees }
    } catch (err) {
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
};

//get weekly claim reporting
exports.claimWeeklyReporting = async (data) => {
    try {
        // Parse startDate and endDate from request body
        const startDate = moment(data.startDate).startOf('day');
        const endDate = moment(data.endDate).endOf('day');
        // Example: Adjusting dates with moment.js if needed
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

        if (data.dealerId != "") {
            let dealerId = new mongoose.Types.ObjectId(data.dealerId)
            dailyQuery[0].$match.dealerId = dealerId
            dailyQuery1[0].$match.dealerId = dealerId
            dailyQuery2[0].$match.dealerId = dealerId
            dailyQuery3[0].$match.dealerId = dealerId
        }
        if (data.servicerId != "") {
            let servicerId = new mongoose.Types.ObjectId(data.servicerId)
            dailyQuery[0].$match.servicerId = servicerId
            dailyQuery1[0].$match.servicerId = servicerId
            dailyQuery2[0].$match.servicerId = servicerId
            dailyQuery3[0].$match.servicerId = servicerId
        }
        if (data.customerId) {
            let servicerId = new mongoose.Types.ObjectId(data.customerId)
            dailyQuery[0].$match.customerId = data.customerId
            dailyQuery1[0].$match.customerId = data.customerId
            dailyQuery2[0].$match.customerId = data.customerId
            dailyQuery3[0].$match.customerId = data.customerId
        }
        if (data.priceBookId.length != 0) {
            let getOrders = await orderService.getOrders({ productsArray: { $elemMatch: { priceBookId: { $in: data.priceBookId } } } })
            let orderIds = getOrders.map(ID => ID.unique_key)
            dailyQuery[0].$match.orderId = { $in: orderIds }
            dailyQuery1[0].$match.orderId = { $in: orderIds }
            dailyQuery2[0].$match.orderId = { $in: orderIds }
            dailyQuery3[0].$match.orderId = { $in: orderIds }
        }

        let getData = await claimService.getClaimWithAggregate(dailyQuery)
        let getData1 = await claimService.getClaimWithAggregate(dailyQuery1)
        let getData2 = await claimService.getClaimWithAggregate(dailyQuery2)
        let getData3 = await claimService.getClaimWithAggregate(dailyQuery3)

        if (getData[0]) {
            getData[0]._id = datesArray[0]
        }
        if (getData1[0]) {
            getData1[0]._id = datesArray[0]
        }
        if (getData2[0]) {
            getData2[0]._id = datesArray[0]
        }
        if (getData3[0]) {
            getData3[0]._id = datesArray[0]
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
            const order = getData1.find(item => moment(item._id).format('YYYY-MM-DD') === dateString);
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

        const mergedArray = result.map(item => {
            const result1Item = result1.find(r1 => r1.weekStart === item.weekStart);
            const result2Item = result2.find(r2 => r2.weekStart === item.weekStart);
            const result3Item = result3.find(r3 => r3.weekStart === item.weekStart);

            if (data.role == 'Super Admin') {
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
            }
            if (data.role == 'Dealer') {
                if (data.isServicer) {
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
                } else {
                    return {
                        weekStart: item.weekStart,
                        total_amount: item.total_amount,
                        total_claim: item.total_claim,
                        total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0
                    };
                }

            }
            if (data.role == 'Reseller') {
                if (data.isServicer) {
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
                } else {
                    return {
                        weekStart: item.weekStart,
                        total_amount: item.total_amount,
                        total_claim: item.total_claim,
                        total_rejected_claim: result3Item ? result3Item.total_rejected_claim : 0
                    };
                }
            }
            if (data.role == 'Customer') {
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
            }
            if (data.role == "Servicer") {
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
            }
        });

        let totalFees = []
        if (data.role = "Super Admin") {
            totalFees = mergedArray.reduce((acc, curr) => {
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
        }
        return { graphData: mergedArray, totalFees }
    } catch (err) {
        return { code: constant.errorCode, message: err.message }
    }
};

//Get claim day reporting
exports.claimDayReporting = async (data) => {
    try {
        data.dayDate = data.startDate
        const today = new Date(data.dayDate);
        // Set the start of the day
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        // Set the end of the day
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

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
            let servicerId = new mongoose.Types.ObjectId(data.servicerId)
            dailyQuery[0].$match.servicerId = data.servicerId
            dailyQuery1[0].$match.servicerId = data.servicerId
            dailyQuery2[0].$match.servicerId = data.servicerId
            dailyQuery3[0].$match.servicerId = data.servicerId
        }
        if (data.customerId) {
            let servicerId = new mongoose.Types.ObjectId(data.customerId)
            dailyQuery[0].$match.customerId = data.customerId
            dailyQuery1[0].$match.customerId = data.customerId
            dailyQuery2[0].$match.customerId = data.customerId
            dailyQuery3[0].$match.customerId = data.customerId
        }

        let getData = await claimService.getClaimWithAggregate(dailyQuery)
        let getData1 = await claimService.getClaimWithAggregate(dailyQuery1)
        let getData2 = await claimService.getClaimWithAggregate(dailyQuery2)
        let getData3 = await claimService.getClaimWithAggregate(dailyQuery3)

        let checkdate = new Date(data.dayDate).setDate(new Date(data.dayDate).getDate() + 0);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        let result
        if (data.role == "Super Admin") {
            result = [{
                weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                total_unpaid_amount: data.returnValue.total_unpaid_amount == 1 ? getData1.length ? getData1[0].total_unpaid_amount : 0 : 0,
                total_unpaid_claim: data.returnValue.total_unpaid_claim == 1 ? getData1.length ? getData1[0].total_unpaid_claim : 0 : 0,
                total_paid_amount: data.returnValue.total_paid_amount == 1 ? getData2.length ? getData2[0].total_paid_amount : 0 : 0,
                total_paid_claim: data.returnValue.total_paid_claim == 1 ? getData2.length ? getData2[0].total_paid_claim : 0 : 0,
                total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
            }];
        }
        if (data.role == "Dealer") {
            if (data.isServicer) {
                result = [{
                    weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                    total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                    total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                    total_unpaid_amount: data.returnValue.total_unpaid_amount == 1 ? getData1.length ? getData1[0].total_unpaid_amount : 0 : 0,
                    total_unpaid_claim: data.returnValue.total_unpaid_claim == 1 ? getData1.length ? getData1[0].total_unpaid_claim : 0 : 0,
                    total_paid_amount: data.returnValue.total_paid_amount == 1 ? getData2.length ? getData2[0].total_paid_amount : 0 : 0,
                    total_paid_claim: data.returnValue.total_paid_claim == 1 ? getData2.length ? getData2[0].total_paid_claim : 0 : 0,
                    total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
                }];
            } else {
                result = [{
                    weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                    total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                    total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                    total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
                }];
            }

        }
        if (data.role == "Reseller") {
            if (data.isServicer) {
                result = [{
                    weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                    total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                    total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                    total_unpaid_amount: data.returnValue.total_unpaid_amount == 1 ? getData1.length ? getData1[0].total_unpaid_amount : 0 : 0,
                    total_unpaid_claim: data.returnValue.total_unpaid_claim == 1 ? getData1.length ? getData1[0].total_unpaid_claim : 0 : 0,
                    total_paid_amount: data.returnValue.total_paid_amount == 1 ? getData2.length ? getData2[0].total_paid_amount : 0 : 0,
                    total_paid_claim: data.returnValue.total_paid_claim == 1 ? getData2.length ? getData2[0].total_paid_claim : 0 : 0,
                    total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
                }];
            } else {
                result = [{
                    weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                    total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                    total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                    total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
                }];
            }
        }
        if (data.role == "Customer") {
            result = [{
                weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                total_unpaid_amount: data.returnValue.total_unpaid_amount == 1 ? getData1.length ? getData1[0].total_unpaid_amount : 0 : 0,
                total_unpaid_claim: data.returnValue.total_unpaid_claim == 1 ? getData1.length ? getData1[0].total_unpaid_claim : 0 : 0,
                total_paid_amount: data.returnValue.total_paid_amount == 1 ? getData2.length ? getData2[0].total_paid_amount : 0 : 0,
                total_paid_claim: data.returnValue.total_paid_claim == 1 ? getData2.length ? getData2[0].total_paid_claim : 0 : 0,
                total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
            }];
        }
        if (data.role == "Servicer") {
            result = [{
                weekStart: new Date(checkdate).toLocaleDateString('en-US', options),
                total_amount: data.returnValue.total_amount == 1 ? getData.length ? getData[0].total_amount : 0 : 0,
                total_claim: data.returnValue.total_claim == 1 ? getData.length ? getData[0].total_claim : 0 : 0,
                total_unpaid_amount: data.returnValue.total_unpaid_amount == 1 ? getData1.length ? getData1[0].total_unpaid_amount : 0 : 0,
                total_unpaid_claim: data.returnValue.total_unpaid_claim == 1 ? getData1.length ? getData1[0].total_unpaid_claim : 0 : 0,
                total_paid_amount: data.returnValue.total_paid_amount == 1 ? getData2.length ? getData2[0].total_paid_amount : 0 : 0,
                total_paid_claim: data.returnValue.total_paid_claim == 1 ? getData2.length ? getData2[0].total_paid_claim : 0 : 0,
                total_rejected_claim: data.returnValue.total_rejected_claim == 1 ? getData3.length ? getData3[0].total_rejected_claim : 0 : 0,
            }];
        }

        let totalFees = []
        if (data.role = "Super Admin") {
            totalFees = result.reduce((acc, curr) => {
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
        }
        return { result, totalFees }
    } catch (err) {
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
};

//Get dropdown for reporting
exports.getReportingDropdowns = async (req, res) => {
    try {
        let data = req.body
        let result;
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }, { name: 1 })
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 1, name: 1, pName: 1, coverageType: 1 })
        const convertedData = getDealers.map(item => ({
            value: item._id,
            label: item.name
        }));

        let priceBook = getPriceBooks.map(item => ({
            value: item._id,
            label: item.name
        }));
        let categories = getCategories.map(item => ({
            value: item._id,
            label: item.name
        }));

        result = {
            getDealers: convertedData,
            getPriceBooks: priceBook,
            getCategories: categories
        }

        if (data.dealerId != "") {
            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })
            priceBook = getPriceBooks1.map(item => ({
                value: item._id,
                label: item.name
            }));
            categories = getCategories1.map(item => ({
                value: item._id,
                label: item.name
            }));
            result = {
                getDealers: convertedData,
                getPriceBooks: priceBook,
                getCategories: categories
            }
            if (data.categoryId != "") {
                let getPriceBooks2 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                priceBook = getPriceBooks2.map(item => ({
                    value: item._id,
                    label: item.name
                }));

                result = {
                    getDealers: convertedData,
                    getPriceBooks: priceBook,
                    getCategories: categories
                }
            }
        }
        if (data.categoryId != "" && data.dealerId == "") {
            let getPriceBooks2 = await priceBookService.getAllPriceIds({ category: data.categoryId })
            priceBook = getPriceBooks2.map(item => ({
                value: item._id,
                label: item.name
            }));
            result = {
                getDealers: [],
                getPriceBooks: priceBook,
                getCategories: categories
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

// drop down values for claim reporting
exports.claimReportinDropdown = async (req, res) => {
    try {
        let data = req.body
        let result;
        let getDealers = await dealerService.getAllDealers({ status: "Approved" })
        let getServicer = await providerService.getAllServiceProvider({ accountStatus: "Approved", dealerId: null, resellerId: null })
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 1, name: 1, pName: 1, coverageType: 1 })

        result = {
            dealers: getDealers,
            servicers: getServicer,
            priceBooks: getPriceBooks,
            categories: getCategories
        }
        if (data.primary == "dealer") {
            if (data.dealerId != "") {
                let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: data.dealerId })
                let ids = getServicersIds?.map((item) => item.servicerId)
                let servicer = await servicerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
                // Get Dealer Reseller Servicer
                let dealerResellerServicer = await resellerService.getResellers({ dealerId: data.dealerId, isServicer: true })
                if (dealerResellerServicer.length > 0) {
                    servicer.unshift(...dealerResellerServicer);
                }
                let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId })
                if (!checkDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Invalid dealer ID"
                    })
                    return;
                }
                if (checkDealer.isServicer) {
                    servicer.unshift(checkDealer);
                };
                let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
                let priceBookIds = getDealerBooks?.map(ID => ID.priceBook)
                let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
                let categoriesIds = getPriceBooks1?.map(ID => ID.category)
                let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })
                if (data.categoryId != "") {
                    getPriceBooks1 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                }
                if (data.priceBookId.length != 0 && data.categoryId == "") {
                    getCategories1 = []
                }
                result = {
                    dealers: getDealers,
                    priceBooks: getPriceBooks1,
                    servicers: servicer,
                    categories: getCategories1
                }
            } else {
                result = {
                    dealers: getDealers,
                    priceBooks: [],
                    servicers: [],
                    categories: []
                }
            }
        }
        if (data.primary == "servicer") {
            let servicerId;
            if (data.servicerId != "") {
                servicerId = [new mongoose.Types.ObjectId(req.body.servicerId)]
            } else {
                servicerId = getServicer.map(ID => new mongoose.Types.ObjectId(ID._id))
            }
            //getting servicers dealers ----------
            let query = [
                {
                    $match: {
                        servicerId: { $in: servicerId }
                    }
                },
                {
                    $lookup: {
                        from: "dealers",
                        localField: "dealerId",
                        foreignField: "_id",
                        as: "dealerData",
                    }
                },
                {
                    $unwind: "$dealerData"
                },
                {
                    $project: {
                        "dealerData": 1,
                        _id: 0
                    }
                }

            ]
            let filteredData = await dealerRelationService.getDealerRelationsAggregate(query)
            let dealerIds = filteredData.map(ID => ID.dealerData._id)
            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: { $in: dealerIds } })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })

            if (data.dealerId != "") {
                let getDealerBooks1 = await dealerPriceService.findAllDealerPrice({ dealerId: { $in: dealerIds } })
                let priceBookIds1 = getDealerBooks1.map(ID => ID.priceBook)
                getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds1 } })
                let categoriesIds1 = getPriceBooks1.map(ID => ID.category)
                getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds1 } })
            }
            if (data.categoryId != "") {
                getPriceBooks1 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
            }
            if (data.priceBookId.length != 0 && data.categoryId == "") {
                getCategories1 = []
            }
            filteredData = {
                dealers: filteredData.map(dealer => {
                    return {
                        _id: dealer.dealerData._id,
                        name: dealer.dealerData.name
                    };
                })
            };
            result = {
                dealers: filteredData.dealers,
                priceBooks: getPriceBooks1,
                servicers: getServicer,
                categories: getCategories1
            }

        }

        if (data.primary == "category") {
            if (data.categoryId != "") {
                getPriceBooks = await priceBookService.getAllPriceIds({ category: data.categoryId })
            }
            if (data.priceBookId.length != 0) {
                getCategories = []
            }
            result = {
                dealers: [],
                servicers: [],
                priceBooks: getPriceBooks,
                categories: getCategories
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




