require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const resellerService = require("../services/resellerService");
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
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


module.exports = async (req, res) => {
    try {
        let data = req.body
        let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.name}$`, 'i') }, {})
        if (checkName) {
            res.send({
                code: constant.errorCode,
                message: "Reseller already exist with this account name"
            })
            return;
        };
        
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}