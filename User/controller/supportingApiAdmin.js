require("dotenv").config();
const bcrypt = require("bcrypt");
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
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const logs = require('../model/logs');
const csvParser = require('csv-parser');
const supportingFunction = require('../../config/supportingFunction')
const reportingController = require("./reportingController");
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');


// s3 bucket connections
const s3 = new S3Client({
    region: process.env.region,
    credentials: {
        accessKeyId: process.env.aws_access_key_id,
        secretAccessKey: process.env.aws_secret_access_key,
    }
});

const Storage = multerS3({
    s3: s3,
    bucket: process.env.bucket_name, // Ensure this environment variable is set
    metadata: (req, files, cb) => {
        cb(null, { fieldName: files.fieldname });
    },
    key: (req, files, cb) => {
        const fileName = files.fieldname + '-' + Date.now() + path.extname(files.originalname);
        cb(null, fileName);
    }
});

var upload = multer({
    storage: Storage,
}).any([
    { name: "file" },
    { name: "termCondition" },
])



//Create Dealer by super admin
exports.createDealer = async (req, res) => {
    try {
        upload(req, res, async () => {
            const data = req.body;
            data.name = data.name.trim().replace(/\s+/g, ' ');
            const loginUser = await userService.getUserById1({ accountId: req.userId, isPrimary: true }, {});

            let priceFile
            let termFile;
            let isAccountCreate = req.body.isAccountCreate
            let file = req.files
            for (i = 0; i < file.length; i++) {
                if (file[i].fieldname == 'termCondition') {
                    termFile = file[i]
                    // termFile.push(file[i].filename);
                } else if (file[i].fieldname == 'file') {
                    priceFile = file[i]
                }
            }

            let termData = {
                fileName: termFile ? termFile.filename : '',
                name: termFile ? termFile.originalname : '',
                size: termFile ? termFile.size : '',
            }

            // Check if the specified role exists
            const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
            if (!checkRole) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid role"
                });
                return;
            }

            let priceBook = [];
            let priceBookIds = [];
            const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
            const dealersUserData = data.dealers ? data.dealers : [];
            const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
            let checkPriceBook = [];
            let dealerPriceArray = data.priceBook ? data.priceBook : [];
            const uniqueEmails = new Set(allEmails);
            if (allEmails.length !== uniqueEmails.size) {
                res.send({
                    code: constant.errorCode,
                    message: 'Multiple user cannot have same email',
                });
                return
            }

            let count = await dealerPriceService.getDealerPriceCount();

            let savePriceBookType = req.body.savePriceBookType
            const allUserData = [...dealersUserData, ...primaryUserData];

            if (data.dealerId != 'null' && data.dealerId != undefined) {
                let createUsers = [];

                if (data.email != data.oldEmail) {
                    let emailCheck = await userService.findOneUser({ email: data.email }, {});
                    if (emailCheck) {
                        res.send({
                            code: constant.errorCode,
                            message: "Primary user email already exist"
                        })
                        return;
                    }
                }

                if (data.name != data.oldName) {
                    let nameCheck = await dealerService.getDealerByName({ name: data.name });
                    if (nameCheck) {
                        res.send({
                            code: constant.errorCode,
                            message: "Dealer name already exist"
                        })
                        return;
                    }
                }

                const singleDealerUser = await userService.findOneUser({ accountId: data.dealerId }, {});
                const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
                if (!singleDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Dealer Not found"
                    });
                    return;
                }

                if (savePriceBookType == 'yes') {
                    priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
                    const priceBookCreateria = { _id: { $in: priceBook } }
                    checkPriceBook = await priceBookService.getMultiplePriceBook(priceBookCreateria, { isDeleted: false })

                    if (checkPriceBook.length == 0) {
                        res.send({
                            code: constant.errorCode,
                            message: "Product does not exist.Please check the product"
                        })
                        return;
                    }

                    const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
                    if (missingProductNames.length > 0) {
                        res.send({
                            code: constant.errorCode,
                            message: 'Some products is not created. Please check the product',
                            missingProductNames: missingProductNames
                        });
                        return;
                    }

                    const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
                    const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

                    if (cleanStr1 !== cleanStr2) {
                        const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
                        if (existingDealer) {
                            res.send({
                                code: constant.errorCode,
                                message: 'Dealer name already exists',
                            });
                            return
                        }
                    }
                    //check product is already exist for dealer this
                    priceBookIds = dealerPriceArray.map((dealer) => new mongoose.Types.ObjectId(dealer.priceBookId));

                    if (priceBook.length > 0) {
                        let query = {
                            $and: [
                                { 'priceBook': { $in: priceBookIds } },
                                { 'dealerId': new mongoose.Types.ObjectId(data.dealerId) }
                            ]
                        }

                        const existingData = await dealerPriceService.findByIds(query);

                        if (existingData.length > 0) {
                            res.send({
                                code: constant.errorCode,
                                message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
                            });
                            return;
                        }
                    }

                    const resultPriceData = dealerPriceArray.map((obj, index) => ({
                        'priceBook': obj.priceBookId,
                        'dealerId': data.dealerId,
                        'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
                        'retailPrice': obj.retailPrice,
                        "status": obj.status,
                        'wholesalePrice': obj.wholesalePrice,
                        'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
                    }));
                    //Primary information edit
                    let userQuery = { accountId: { $in: [data.dealerId] }, isPrimary: true }
                    let newValues1 = {
                        $set: {
                            email: allUserData[0].email,
                            firstName: allUserData[0].firstName,
                            lastName: allUserData[0].lastName,
                            phoneNumber: allUserData[0].phoneNumber,
                            position: allUserData[0].position,
                            roleId: '656f08041eb1acda244af8c6',
                            status: allUserData[0].status ? true : false,
                        }
                    }

                    await userService.updateUser(userQuery, newValues1, { new: true })
                    const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
                    // Save Logs when price book created

                    if (!createPriceBook) {
                        let logData = {
                            userId: req.teammateId,
                            endpoint: "user/createDealer",
                            body: req.body,
                            response: {
                                code: constant.errorCode,
                                message: "Unable to save price book"
                            }
                        }
                        await logs(logData).save()
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to save price book"
                        });
                        return;
                    }

                    // Save Logs
                    let logData = {
                        userId: req.teammateId,
                        endpoint: "user/createDealer",
                        body: req.body,
                        response: {
                            code: constant.successCode,
                            message: "Saved Successfully!",
                            result: createPriceBook
                        }
                    }
                    await logs(logData).save()

                    let allUsersData = allUserData.map((obj, index) => ({
                        ...obj,
                        roleId: '656f08041eb1acda244af8c6',
                        accountId: data.dealerId,
                        metaId: data.dealerId,
                        isPrimary: index === 0 ? true : false,
                        status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status
                    }));

                    if (allUsersData.length > 1) {
                        allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
                        createUsers = await userService.insertManyUser(allUsersData);
                        if (!createUsers) {
                            res.send({
                                code: constant.errorCode,
                                message: "Unable to save users"
                            });
                            return;
                        }
                    }
                    let dealerQuery = { _id: data.dealerId }
                    let newValues = {
                        $set: {
                            status: "Approved",
                            serviceCoverageType: req.body.serviceCoverageType,
                            isShippingAllowed: req.body.isShippingAllowed,
                            isAccountCreate: isAccountCreate,
                            coverageType: req.body.coverageType,
                            termCondition: termData,
                            accountStatus: true,
                            isAccountCreate: isAccountCreate,
                            isServicer: data.isServicer ? data.isServicer : false
                        }
                    }

                    let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })

                    if (!dealerStatus) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to approve dealer status"
                        });
                        return;
                    }


                    let statusUpdateCreateria = { accountId: { $in: [data.dealerId] } }
                    let updateData = {
                        $set: {
                            approvedStatus: 'Approved'
                        }
                    }
                    await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

                    // Send notification when approved
                    let IDs = await supportingFunction.getUserIds()
                    IDs.push(req.body.dealerId);
                    let notificationData = {
                        title: "Dealer Approval",
                        description: req.body.name + " " + "has been successfully approved",
                        userId: req.teammateId,
                        flag: 'dealer',
                        notificationFor: IDs
                    };

                    await userService.createNotification(notificationData);
                    // Primary User Welcoime email
                    let notificationEmails = await supportingFunction.getUserEmails();
                    let emailData = {
                        senderName: loginUser.firstName,
                        content: "We are delighted to inform you that the dealer account for " + singleDealer.name + " has been approved.",
                        subject: "Dealer Account Approved - " + singleDealer.name
                    }
                    // Send Email code here
                    sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))

                    if (req.body.isAccountCreate) {
                        for (let i = 0; i < createUsers.length; i++) {
                            // Send mail to all User except primary
                            if (createUsers[i].status) {
                                let resetPasswordCode = randtoken.generate(4, '123456789')
                                let email = createUsers[i].email;
                                let userId = createUsers[i]._id;
                                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                                sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                                await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                            }
                        }
                        // Send mail to  primary
                        let resetPrimaryCode = randtoken.generate(4, '123456789')
                        let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
                        sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { subject: "Set Password", link: resetPrimaryLink, role: req.role, dealerName: singleDealerUser.firstName }))
                        await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

                    }
                    if (req.body.isServicer) {
                        const CountServicer = await providerService.getServicerCount();

                        let servicerObject = {
                            name: data.name,
                            street: data.street,
                            city: data.city,
                            zip: data.zip,
                            dealerId: req.body.dealerId,
                            state: data.state,
                            country: data.country,
                            status: data.status,
                            accountStatus: "Approved",
                            unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                        }

                        let createData = await providerService.createServiceProvider(servicerObject)
                    }
                    // Save Logs
                    logData = {
                        userId: req.teammateId,
                        endpoint: "user/createDealer",
                        body: req.body,
                        response: {
                            code: constant.successCode,
                            message: 'Successfully Created',
                        }
                    }
                    await logs(logData).save()
                    res.send({
                        code: constant.successCode,
                        message: 'Successfully Created',
                    });

                }
                else if (savePriceBookType == 'no') {
                    // uploadP(req, res, async (err) => {
                    let file = req.file
                    let data = req.body

                    const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
                    const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

                    if (cleanStr1 !== cleanStr2) {
                        const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
                        if (existingDealer) {
                            res.send({
                                code: constant.errorCode,
                                message: 'Dealer name already exists',
                            });
                            return
                        }
                    }

                    let csvName = priceFile.filename
                    const csvWriter = createCsvWriter({
                        path: './uploads/resultFile/' + csvName,
                        header: [
                            { id: 'priceBook', title: 'Price Book' },
                            { id: 'status', title: 'Status' },
                            { id: 'reason', title: 'Reason' },
                            // Add more headers as needed
                        ],
                    });
                    const wb = XLSX.readFile(priceFile.path);
                    const sheets = wb.SheetNames;
                    const ws = wb.Sheets[sheets[0]];
                    const headers = [];
                    for (let cell in ws) {
                        // Check if the cell is in the first row and has a non-empty value
                        if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
                            headers.push(ws[cell].v);
                        }
                    }

                    if (headers.length !== 2) {
                        res.send({
                            code: constant.errorCode,
                            message: "Invalid file format detected. The sheet should contain exactly two columns."
                        })
                        return
                    }
                    let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
                    totalDataComing1 = totalDataComing1.map(item => {
                        if (!item['Product SKU']) {
                            return { priceBook: '', 'RetailPrice': item['retailPrice'] };
                        }
                        return item;
                    });
                    const totalDataComing = totalDataComing1.map(item => {

                        const keys = Object.keys(item);

                        return {
                            priceBook: item[keys[0]],
                            retailPrice: item[keys[1]],
                            duplicates: [],
                            exit: false
                        };
                    });

                    // copy to here
                    totalDataComing.forEach((data, index) => {

                        if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
                            data.status = "Dealer catalog retail price is not valid";
                            totalDataComing[index].retailPrice = data.retailPrice
                            data.exit = true;
                        }

                        else {
                            data.status = null
                        }
                    })
                    if (totalDataComing.length > 0) {
                        const repeatedMap = {};

                        for (let i = totalDataComing.length - 1; i >= 0; i--) {
                            if (totalDataComing[i].exit) {
                                continue;
                            }
                            if (repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] >= 0) {
                                totalDataComing[i].status = "not unique";
                                totalDataComing[i].exit = true;
                                const index = repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()];
                                totalDataComing[index].duplicates.push(i);
                            } else {
                                repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] = i;
                                totalDataComing[i].status = null;
                            }
                        }

                        const pricebookArrayPromise = totalDataComing.map(item => {
                            let queryPrice;
                            if (singleDealer?.coverageType == "Breakdown & Accidental") {
                                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true }
                            } else {
                                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true, coverageType: singleDealer?.coverageType }
                            }
                            if (!item.status) return priceBookService.findByName1(queryPrice);
                            return null;
                        })

                        const pricebooksArray = await Promise.all(pricebookArrayPromise);

                        for (let i = 0; i < totalDataComing.length; i++) {
                            if (!pricebooksArray[i]) {
                                if (!totalDataComing[i].exit) {
                                    totalDataComing[i].status = "price catalog does not exist";
                                    totalDataComing[i].duplicates.forEach((index) => {
                                        totalDataComing[index].status = "price catalog does not exist";
                                    })
                                }
                                totalDataComing[i].priceBookDetail = null
                            } else {
                                totalDataComing[i].priceBookDetail = pricebooksArray[i];
                            }
                        }
                        const dealerArrayPromise = totalDataComing.map(item => {

                            if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(req.body.dealerId), priceBook: item.priceBookDetail._id }, {});
                            return false;
                        })
                        const dealerArray = await Promise.all(dealerArrayPromise);

                        for (let i = 0; i < totalDataComing.length; i++) {
                            if (totalDataComing[i].priceBookDetail) {
                                if (dealerArray[i]) {
                                    dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
                                    dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
                                    await dealerArray[i].save();

                                    totalDataComing[i].status = "Dealer catalog updated successully-";
                                    totalDataComing[i].duplicates.forEach((index) => {
                                        totalDataComing[index].status = "Dealer catalog updated successully_";
                                    })

                                } else {
                                    const count = await dealerPriceService.getDealerPriceCount();
                                    let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                                    let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;
                                    await dealerPriceService.createDealerPrice({
                                        dealerId: req.body.dealerId,
                                        priceBook: totalDataComing[i].priceBookDetail._id,
                                        unique_key: unique_key,
                                        status: true,
                                        retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                                        brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                                        wholesalePrice
                                    })
                                    totalDataComing[i].status = "Dealer catalog created successully!"

                                    totalDataComing[i].duplicates.forEach((index, i) => {
                                        let msg = index === 0 ? "Dealer catalog created successully)" : "Dealer catalog updated successully%"
                                        totalDataComing[index].status = msg;
                                    })
                                }
                            }
                        }

                        const csvArray = totalDataComing.map((item) => {
                            return {
                                priceBook: item.priceBook ? item.priceBook : "",
                                retailPrice: item.retailPrice ? item.retailPrice : "",
                                status: item.status
                            }
                        })
                        function countStatus(array, status) {
                            return array.filter(item => item.status === status).length;
                        }

                        const countNotExist = countStatus(csvArray, "price catalog does not exist");
                        const countNotUnique = countStatus(csvArray, "not unique");
                        const totalCount = csvArray.length

                        function convertArrayToHTMLTable(array) {
                            const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
                            const rows = array.map(obj => {
                                const values = Object.values(obj).map(value => `<td>${value}</td>`);
                                values[2] = `${values[2]}`;
                                return values.join('');
                            });

                            const htmlContent = `<html>
                    <head>
                        <style>
                            table {
                                border-collapse: collapse;
                                width: 100%; 
                            }
                            th, td {
                                border: 1px solid #dddddd;
                                text-align: left;
                                padding: 8px;
                            }
                            th {
                                background-color: #f2f2f2;
                            }
                        </style>
                    </head>
                    <body>
                        <table>
                            <thead><tr>${header}</tr></thead>
                            <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                        </table>
                    </body>
                </html>`;

                            return htmlContent;
                        }
                        const notificationEmail = await supportingFunction.getUserEmails();

                        const htmlTableString = convertArrayToHTMLTable(csvArray);
                        const mailing = sgMail.send(emailConstant.sendCsvFile(notificationEmail, ['noreply@getcover.com'], htmlTableString));
                    }
                    let userQuery = { accountId: { $in: [req.body.dealerId] }, isPrimary: true }
                    let newValues1 = {
                        $set: {
                            email: allUserData[0].email,
                            firstName: allUserData[0].firstName,
                            lastName: allUserData[0].lastName,
                            roleId: '656f08041eb1acda244af8c6',
                            phoneNumber: allUserData[0].phoneNumber,
                            position: allUserData[0].position,
                            status: allUserData[0].status ? true : false,
                        }
                    }
                    let updateStatus1 = await userService.updateUser(userQuery, newValues1, { new: true })

                    let allUsersData = allUserData.map((obj, index) => ({
                        ...obj,
                        roleId: '656f08041eb1acda244af8c6',
                        accountId: req.body.dealerId,
                        metaId: req.body.dealerId,
                        isPrimary: index === 0 ? true : false,
                        status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status
                    }));

                    if (allUsersData.length > 1) {
                        allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
                        createUsers = await userService.insertManyUser(allUsersData);
                        if (!createUsers) {
                            let logData = {
                                userId: req.teammateId,
                                endpoint: "user/createDealer",
                                body: req.body,
                                response: {
                                    code: constant.errorCode,
                                    message: "Unable to save users"
                                }
                            }
                            await logs(logData).save()
                            res.send({
                                code: constant.errorCode,
                                message: "Unable to save users"
                            });
                            return;
                        }

                        //Save Logs
                        let logData = {
                            userId: req.teammateId,
                            endpoint: "user/createDealer",
                            body: req.body,
                            response: {
                                code: constant.successCode,
                                message: "Saved Successfully"
                            }
                        }
                        await logs(logData).save()
                    }

                    let dealerQuery = { _id: req.body.dealerId }

                    let newValues = {
                        $set: {
                            status: "Approved",
                            accountStatus: true,
                            serviceCoverageType: req.body.serviceCoverageType,
                            isShippingAllowed: req.body.isShippingAllowed,
                            isAccountCreate: isAccountCreate,
                            coverageType: req.body.coverageType,
                            termCondition: termData,
                            isServicer: data.isServicer ? data.isServicer : false
                        }
                    }

                    let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })

                    if (!dealerStatus) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to approve dealer status"
                        });
                        return;
                    }

                    // Send notification when approved
                    let IDs = await supportingFunction.getUserIds()
                    IDs.push(req.body.dealerId);
                    let notificationData = {
                        title: "Dealer Approved",
                        description: req.body.name + " " + "has been successfully approved",
                        userId: req.teammateId,
                        flag: 'dealer',
                        notificationFor: IDs
                    };
                    let createNotification = await userService.createNotification(notificationData);
                    let statusUpdateCreateria = { accountId: { $in: [req.body.dealerId] } }
                    let updateData = {
                        $set: {
                            approvedStatus: 'Approved'
                        }
                    }
                    let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })
                    // Primary User Welcoime email
                    let notificationEmails = await supportingFunction.getUserEmails();
                    let emailData = {
                        senderName: loginUser.firstName,
                        content: "We are delighted to inform you that the dealer account for " + singleDealer.name + " has been approved.",
                        subject: "Dealer Account Approved - " + singleDealer.name
                    }

                    // Send Email code here
                    let mailing = sgMail.send(emailConstant.sendEmailTemplate(allUserData[0].email, notificationEmails, emailData))
                    // Send Email code here

                    if (req.body.isAccountCreate) {
                        for (let i = 0; i < createUsers.length; i++) {
                            // Send mail to all User except primary
                            if (createUsers[i].status) {
                                let resetPasswordCode = randtoken.generate(4, '123456789')
                                let email = createUsers[i].email;
                                let userId = createUsers[i]._id;
                                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                                let mailing = sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, dealerName: createUsers[i].firstName }))
                                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                            }
                        }
                        // Send mail to  primary
                        let resetPrimaryCode = randtoken.generate(4, '123456789')
                        let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
                        let mailingPrimary = sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { subject: "Set Password", link: resetPrimaryLink, dealerName: singleDealerUser.firstName }))
                        let updatePrimaryStatus = await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

                    }

                    if (req.body.isServicer) {
                        const CountServicer = await providerService.getServicerCount();

                        let servicerObject = {
                            name: data.name,
                            street: data.street,
                            city: data.city,
                            zip: data.zip,
                            dealerId: req.body.dealerId,
                            state: data.state,
                            country: data.country,
                            status: data.status,
                            accountStatus: "Approved",
                            unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                        }

                        let createData = await providerService.createServiceProvider(servicerObject)
                    }
                    res.send({
                        code: constant.successCode,
                        message: 'Successfully Created',
                    });
                    return;

                }

                return;
            }
            else {
                const existingDealer = await dealerService.getDealerByName({ name: data.name }, { isDeleted: 0, __v: 0 });

                if (existingDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: 'Dealer name already exists',
                    });
                    return
                }

                let emailCheck = await userService.findOneUser({ email: data.email }, {});
                if (emailCheck) {
                    res.send({
                        code: constant.errorCode,
                        message: "Primary user email already exist"
                    })
                    return;
                }

                if (savePriceBookType == 'yes') {
                    priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
                    const priceBookCreateria = { _id: { $in: priceBook } }
                    checkPriceBook = await priceBookService.getMultiplePriceBook(priceBookCreateria, { isDeleted: false })
                    if (checkPriceBook.length == 0) {
                        res.send({
                            code: constant.errorCode,
                            message: "Product does not exist.Please check the product"
                        })
                        return;
                    }

                    const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
                    if (missingProductNames.length > 0) {
                        res.send({
                            code: constant.errorCode,
                            message: 'Some products is not created. Please check the product',
                            missingProductNames: missingProductNames
                        });
                        return;
                    }


                    let count = await dealerService.getDealerCount();

                    const dealerMeta = {
                        name: data.name,
                        street: data.street,
                        userAccount: req.body.customerAccountCreated,
                        city: data.city,
                        serviceCoverageType: req.body.serviceCoverageType,
                        isShippingAllowed: req.body.isShippingAllowed,
                        coverageType: req.body.coverageType,
                        isAccountCreate: req.body.isAccountCreate,
                        termCondition: termData,
                        zip: data.zip,
                        state: data.state,
                        isServicer: data.isServicer ? data.isServicer : false,
                        country: data.country,
                        status: 'Approved',
                        accountStatus: true,
                        createdBy: data.createdBy,
                        unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                    };
                    // Create Dealer Meta Data
                    const createMetaData = await dealerService.createDealer(dealerMeta);
                    if (!createMetaData) {
                        //Save Logs
                        let logData = {
                            userId: req.teammateId,
                            endpoint: "user/createDealer",
                            body: req.body,
                            response: {
                                code: constant.errorCode,
                                message: "Unable to create dealer"
                            }
                        }
                        await logs(logData).save()
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to create dealer"
                        });
                        return;
                    }
                    //Save Logs
                    let logData = {
                        userId: req.teammateId,
                        endpoint: "user/createDealer",
                        body: req.body,
                        response: {
                            code: constant.errorCode,
                            message: "Created Successfully"
                        }
                    }
                    await logs(logData).save()

                    //Send Notification to dealer 

                    let IDs = await supportingFunction.getUserIds()

                    let notificationData = {
                        title: "Dealer Creation",
                        description: createMetaData.name + " " + "has been successfully created",
                        userId: req.teammateId,
                        flag: 'dealer',
                        notificationFor: IDs
                    };
                    let createNotification = await userService.createNotification(notificationData);

                    // Create the user

                    if (data.isServicer) {
                        const CountServicer = await providerService.getServicerCount();
                        let servicerObject = {
                            name: data.name,
                            street: data.street,
                            city: data.city,
                            zip: data.zip,
                            dealerId: createMetaData._id,
                            state: data.state,
                            country: data.country,
                            status: data.status,
                            accountStatus: "Approved",
                            unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                        }

                        let createData = await providerService.createServiceProvider(servicerObject)
                    }

                    let allUsersData = allUserData.map((obj, index) => ({
                        ...obj,
                        roleId: '656f08041eb1acda244af8c6',
                        accountId: createMetaData._id,
                        metaId: createMetaData._id,
                        position: obj.position || '', // Using the shorthand for conditional (obj.position ? obj.position : '')
                        isPrimary: index === 0 ? true : false,
                        status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
                        approvedStatus: 'Approved'
                    }));
                    const createUsers = await userService.insertManyUser(allUsersData);
                    if (!createUsers) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to save users"
                        });
                        return;
                    }
                    //save Price Books for this dealer
                    count = await dealerPriceService.getDealerPriceCount();
                    const resultPriceData = dealerPriceArray.map((obj, index) => ({
                        'priceBook': obj.priceBookId,
                        'dealerId': createMetaData._id,
                        'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
                        'retailPrice': obj.retailPrice,
                        'wholesalePrice': obj.wholesalePrice,
                        "status": obj.status,
                        'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
                    }));

                    const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
                    if (!createPriceBook) {
                        //Save Logs
                        let logData = {
                            userId: req.teammateId,
                            endpoint: "user/createDealer",
                            body: req.body,
                            response: {
                                code: constant.errorCode,
                                message: "Unable to save price book"
                            }
                        }
                        await logs(logData).save()
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to save price book"
                        });
                        return;
                    }
                    //Approve status 
                    let notificationEmails = await supportingFunction.getUserEmails();

                    let emailData = {
                        senderName: loginUser.firstName,
                        content: "We are delighted to inform you that the dealer account for " + createMetaData.name + " has been created.",
                        subject: "Dealer Account Created - " + createMetaData.name
                    }

                    sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
                    // Send Email code here
                    if (req.body.isAccountCreate) {
                        for (let i = 0; i < createUsers.length; i++) {
                            if (createUsers[i].status) {
                                let resetPasswordCode = randtoken.generate(4, '123456789')
                                let email = createUsers[i].email;
                                let userId = createUsers[i]._id;
                                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                                let mailing = sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                            }

                        }
                    }
                    res.send({
                        code: constant.successCode,
                        message: 'Successfully Created',
                    });

                    return;

                }

                else if (savePriceBookType == 'no') {

                    let csvName = priceFile.filename
                    const csvWriter = createCsvWriter({
                        path: './uploads/resultFile/' + csvName,
                        header: [
                            { id: 'priceBook', title: 'Price Book' },
                            { id: 'status', title: 'Status' },
                            { id: 'reason', title: 'Reason' },
                            // Add more headers as needed
                        ],
                    });

                    const count = await dealerService.getDealerCount();
                    const results = [];
                    const wb = XLSX.readFile(priceFile.path);
                    const sheets = wb.SheetNames;
                    const ws = wb.Sheets[sheets[0]];
                    const headers = [];
                    for (let cell in ws) {
                        // Check if the cell is in the first row and has a non-empty value
                        if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
                            headers.push(ws[cell].v);
                        }
                    }

                    if (headers.length !== 2) {
                        res.send({
                            code: constant.errorCode,
                            message: "Invalid file format detected. The sheet should contain exactly two columns."
                        })
                        return
                    }

                    let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
                    totalDataComing1 = totalDataComing1.map(item => {
                        if (!item['Product SKU']) {
                            return { priceBook: '', 'RetailPrice': item['retailPrice'] };
                        }
                        return item;
                    });

                    const totalDataComing = totalDataComing1.map(item => {
                        const keys = Object.keys(item);
                        return {
                            priceBook: item[keys[0]],
                            retailPrice: item[keys[1]],
                            duplicates: [],
                            exit: false
                        };
                    });
                    // copy to here
                    totalDataComing.forEach((data, index) => {
                        if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
                            data.status = "Dealer catalog retail price is not valid";
                            totalDataComing[index].retailPrice = data.retailPrice
                            data.exit = true;
                        }
                        else {
                            data.status = null
                        }
                    })
                    const dealerMeta = {
                        name: data.name,
                        street: data.street,
                        userAccount: req.body.customerAccountCreated,
                        city: data.city,
                        zip: data.zip,
                        serviceCoverageType: req.body.serviceCoverageType,
                        isShippingAllowed: req.body.isShippingAllowed,
                        coverageType: req.body.coverageType,
                        isAccountCreate: isAccountCreate,
                        termCondition: termData,
                        state: data.state,
                        country: data.country,
                        isServicer: data.isServicer ? data.isServicer : false,
                        status: 'Approved',
                        accountStatus: true,
                        createdBy: data.createdBy,
                        unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                    };
                    // Create Dealer Meta Data

                    const createMetaData = await dealerService.createDealer(dealerMeta);

                    if (!createMetaData) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to create dealer"
                        });
                        return;
                    }

                    // Send notification 
                    let IDs = await supportingFunction.getUserIds()

                    let notificationData = {
                        title: "Dealer Creation",
                        description: createMetaData.name + " " + "has been successfully created",
                        userId: req.teammateId,
                        flag: 'dealer',
                        notificationFor: IDs
                    };
                    let createNotification = await userService.createNotification(notificationData);

                    if (data.isServicer) {
                        const CountServicer = await providerService.getServicerCount();

                        let servicerObject = {
                            name: data.name,
                            street: data.street,
                            city: data.city,
                            zip: data.zip,
                            dealerId: createMetaData._id,
                            state: data.state,
                            country: data.country,
                            status: data.status,
                            accountStatus: "Approved",
                            unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                        }

                        let createData = await providerService.createServiceProvider(servicerObject)
                    }

                    if (totalDataComing.length > 0) {
                        const repeatedMap = {};

                        for (let i = totalDataComing.length - 1; i >= 0; i--) {
                            if (totalDataComing[i].exit) {
                                continue;
                            }
                            if (repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] >= 0) {
                                totalDataComing[i].status = "not unique";
                                totalDataComing[i].exit = true;
                                const index = repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()];
                                totalDataComing[index].duplicates.push(i);
                            } else {
                                repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] = i;
                                totalDataComing[i].status = null;
                            }
                        }

                        const pricebookArrayPromise = totalDataComing.map(item => {
                            let queryPrice;
                            if (createMetaData?.coverageType == "Breakdown & Accidental") {
                                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true }
                            } else {
                                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true, coverageType: createMetaData?.coverageType }
                            }
                            if (!item.status) return priceBookService.findByName1(queryPrice);
                            return null;
                        })

                        const pricebooksArray = await Promise.all(pricebookArrayPromise);

                        for (let i = 0; i < totalDataComing.length; i++) {
                            if (!pricebooksArray[i]) {
                                if (!totalDataComing[i].exit) {
                                    totalDataComing[i].status = "price catalog does not exist";
                                    totalDataComing[i].duplicates.forEach((index) => {
                                        totalDataComing[index].status = "price catalog does not exist";
                                    })
                                }
                                totalDataComing[i].priceBookDetail = null
                            } else {
                                totalDataComing[i].priceBookDetail = pricebooksArray[i];
                            }
                        }
                        const dealerArrayPromise = totalDataComing.map(item => {

                            if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(createMetaData._id), priceBook: item.priceBookDetail._id }, {});
                            return false;
                        })
                        const dealerArray = await Promise.all(dealerArrayPromise);

                        for (let i = 0; i < totalDataComing.length; i++) {
                            if (totalDataComing[i].priceBookDetail) {
                                if (dealerArray[i]) {
                                    dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
                                    dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
                                    await dealerArray[i].save();

                                    totalDataComing[i].status = "Dealer catalog updated successully-";
                                    totalDataComing[i].duplicates.forEach((index) => {
                                        totalDataComing[index].status = "Dealer catalog updated successully_";
                                    })

                                } else {
                                    const count = await dealerPriceService.getDealerPriceCount();
                                    let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                                    let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;

                                    await dealerPriceService.createDealerPrice({
                                        dealerId: createMetaData._id,
                                        priceBook: totalDataComing[i].priceBookDetail._id,
                                        unique_key: unique_key,
                                        status: true,
                                        retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                                        brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                                        wholesalePrice
                                    })
                                    totalDataComing[i].status = "Dealer catalog created successully!"

                                    totalDataComing[i].duplicates.forEach((index, i) => {
                                        let msg = index === 0 ? "Dealer catalog created successully)" : "Dealer catalog updated successully%"
                                        totalDataComing[index].status = msg;
                                    })
                                }
                            }
                        }

                        const csvArray = totalDataComing.map((item) => {
                            return {
                                priceBook: item.priceBook ? item.priceBook : "",
                                retailPrice: item.retailPrice ? item.retailPrice : "",
                                status: item.status
                            }
                        })
                        function countStatus(array, status) {
                            return array.filter(item => item.status === status).length;
                        }

                        const countNotExist = countStatus(csvArray, "price catalog does not exist");
                        const countNotUnique = countStatus(csvArray, "not unique");
                        const totalCount = csvArray.length

                        function convertArrayToHTMLTable(array) {
                            const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
                            const rows = array.map(obj => {
                                const values = Object.values(obj).map(value => `<td>${value}</td>`);
                                values[2] = `${values[2]}`;
                                return values.join('');
                            });

                            const htmlContent = `<html>
                    <head>
                        <style>
                            table {
                                border-collapse: collapse;
                                width: 100%; 
                            }
                            th, td {
                                border: 1px solid #dddddd;
                                text-align: left;
                                padding: 8px;
                            }
                            th { 
                                background-color: #f2f2f2;
                            }
                        </style>
                    </head>
                    <body>
                        <table>
                            <thead><tr>${header}</tr></thead>
                            <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                        </table>
                    </body>
                </html>`;

                            return htmlContent;
                        }

                        const htmlTableString = convertArrayToHTMLTable(csvArray);
                        const notificationEmail = await supportingFunction.getUserEmails();
                        const mailing = sgMail.send(emailConstant.sendCsvFile(notificationEmail, ['noreply@getcover.com'], htmlTableString));
                    }

                    let allUsersData = allUserData.map((obj, index) => ({
                        ...obj,
                        roleId: '656f08041eb1acda244af8c6',
                        accountId: createMetaData._id,
                        metaId: createMetaData._id,
                        position: obj.position || '', // Using the shorthand for conditional (obj.position ? obj.position : '')
                        isPrimary: index === 0 ? true : false,
                        status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
                        approvedStatus: 'Approved'
                    }));

                    const createUsers = await userService.insertManyUser(allUsersData);
                    if (!createUsers) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to save users"
                        });
                        return;
                    }
                    let dealerQuery = { _id: createMetaData._id }
                    let newValues = {
                        $set: {
                            status: "Approved",
                        }
                    }
                    let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
                    if (!dealerStatus) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to approve dealer status"
                        });
                        return;
                    }

                    let statusUpdateCreateria = { accountId: { $in: [createMetaData._id] } }
                    let updateData = {
                        $set: {
                            approvedStatus: 'Approved'
                        }
                    }
                    let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

                    let notificationEmails = await supportingFunction.getUserEmails();
                    let emailData = {
                        senderName: loginUser.firstName,
                        content: "We are delighted to inform you that the dealer account for " + createMetaData.name + " has been created.",
                        subject: "Dealer Account Created - " + createMetaData.name
                    }
                    sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
                    // Send Email code here

                    if (req.body.isAccountCreate) {
                        for (let i = 0; i < createUsers.length; i++) {
                            if (createUsers[i].status) {
                                let resetPasswordCode = randtoken.generate(4, '123456789')
                                let email = createUsers[i].email;
                                let userId = createUsers[i]._id;
                                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                                let mailing = sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                            }

                        }
                    }
                    res.send({
                        code: constant.successCode,
                        message: 'Successfully Created',
                    });

                }
            }

        })
    } catch (err) {
        //Save Logs
        let logData = {
            userId: req.teammateId,
            endpoint: "user/createDealer catch",
            body: req.body,
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await logs(logData).save()
        return res.send({
            code: constant.errorCode,
            message: err.message
        });
    }
};

//Create new service provider By SA
exports.createServiceProvider = async (req, res) => {
    try {
        const data = req.body;
        const providerUserArray = data.providers;
        // Find data by email
        const emailValues = providerUserArray.map(value => value.email);

        const userData = await userService.findByEmail(emailValues);

        if (userData) {
            return res.send({
                code: constant.errorCode,
                message: 'Email Already Exists',
                data: userData
            });
        }

        // Check if the specified role exists
        const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
        if (!checkRole) {
            return res.send({
                code: constant.errorCode,
                message: 'Invalid role',
            });
        }

        // Create a new provider meta data
        const providerMeta = {
            name: data.name,
            street: data.street,
            city: data.city,
            zip: data.zip,
            userAccount: req.body.customerAccountCreated,
            state: data.state,
            country: data.country,
            createdBy: data.createdBy,
        };

        // Create the service provider
        const createMetaData = await providerService.createServiceProvider(providerMeta);
        providerMeta.role = "Servicer"
        const createMetaData1 = await userMetaService.createMeta(providerMeta);
        if (!createMetaData) {
            return res.send({
                code: constant.errorCode,
                message: 'Unable to create servicer account',
            });
        }

        // Remove duplicates
        const resultProvider = providerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
        const resultProviderData = accountCreationFlag
            ? await Promise.all(resultProvider.map(async (obj) => {
                const hashedPassword = await bcrypt.hash(obj.password, 10);
                return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, metaId: createMetaData._id, status: true, password: hashedPassword };
            }))
            : await Promise.all(resultProvider.map(async (obj) => {
                const hashedPassword = await bcrypt.hash(obj.password, 10);
                return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, metaId: createMetaData._id, password: hashedPassword };
            }));

        // Map provider data
        // Create provider users
        const createProviderUsers = await userService.insertManyUser(resultProviderData);
        if (!createProviderUsers) {
            return res.send({
                code: constant.errorCode,
                message: 'Unable to create users',
            });
        }

        return res.send({
            code: constant.successCode,
            message: 'Successfully Created',
        });

    } catch (err) {
        return res.send({
            code: constant.errorCode,
            message: err.message,
            data: createMetaData
        });
    }
};
