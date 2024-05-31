const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const path = require("path");
const { claimStatus } = require("../model/claimStatus");
const { comments } = require("../model/comments");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const sgMail = require('@sendgrid/mail');
const moment = require("moment");
const LOG = require('../model/logs')
sgMail.setApiKey(process.env.sendgrid_key);
const emailConstant = require('../../config/emailConstant');
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const userService = require("../services/userService");
const contractService = require("../../Contract/services/contractService");
const servicerService = require("../../Provider/services/providerService");
const multer = require("multer");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const priceBookService = require("../../PriceBook/services/priceBookService");
const XLSX = require("xlsx");
const fs = require("fs");
const dealerService = require("../../Dealer/services/dealerService");
const resellerService = require("../../Dealer/services/resellerService");
const customerService = require("../../Customer/services/customerService");
const providerService = require("../../Provider/services/providerService");

exports.dailySales = async (req, res) => {
    try {
        let data = req.body
        let query;
        let getOrders = await orderService.getAllOrders(query);
        if (!getOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}