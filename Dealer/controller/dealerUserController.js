require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
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
})

var uploadP = multer({
    storage: StorageP,
}).single('file');


exports.getDealerUsers = async (req, res) => {
    try {
        let data = req.body
        //fetching data from user table

        const dealers = await dealerService.getSingleDealerById({ _id: req.userId }, { accountStatus: 1 });

        //result.metaData = singleDealer
        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found"
            });
            return;
        };
        const users = await dealerService.getUserByDealerId({ accountId: req.userId, isDeleted: false });

        let name = data.firstName ? data.firstName : ""
        let nameArray = name.trim().split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };

        const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
        const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')


        const filteredData = users.filter(entry => {
            return (
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });


        //result.metaData = singleDealer
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
            dealerStatus: dealers[0].accountStatus
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getPriceBooks = async (req, res) => {
    try {
        let checkDealer = await dealerService.getSingleDealerById({ _id: req.userId, status: true }, { isDeleted: false })

        if (checkDealer.length == 0) {
            res.send({
                code: constant.errorCode,
                message: "Dealer Not found"
            })
            return;
        }
        let projection = { isDeleted: 0, __v: 0 }
        let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(req.userId) }
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
}

























