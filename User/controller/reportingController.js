require("dotenv").config();

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

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


// daily query for reporting 



exports.dailySales = async (req, res) => {
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

        console.log(startOfMonth,endOfMonth)
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
        let getOrders = await orderService.getAllOrders1([dailyQuery]);
        if (!getOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        }
        const result = datesArray.map(date => {
            const dateString = date.toISOString().slice(0,10);
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