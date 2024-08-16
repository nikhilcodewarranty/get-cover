const { Order } = require("../model/order");
require("dotenv").config()
const orderResourceResponse = require("../utils/constant");
const pdf = require('html-pdf');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const orderService = require("../services/orderService");
const supportingFunction = require('../../config/supportingFunction')
const LOG = require('../../User/model/logs')
const emailConstant = require('../../config/emailConstant');
const dealerService = require("../../Dealer/services/dealerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const resellerService = require("../../Dealer/services/resellerService");
const servicerService = require("../../Provider/services/providerService");
const contractService = require("../../Contract/services/contractService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const XLSX = require("xlsx");
const fs = require("fs");
const moment = require("moment");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const userService = require("../../User/services/userService");
const PDFDocument = require('pdfkit');
const claimService = require("../../Claim/services/claimService");
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const S3 = new AWS.S3();
// s3 bucket connections
const s3 = new S3Client({
    region: process.env.region,
    credentials: {
        accessKeyId: process.env.aws_access_key_id,
        secretAccessKey: process.env.aws_secret_access_key,
    }
});
const folderName = 'orderFile'; // Replace with your specific folder name
const StorageP = multerS3({
    s3: s3,
    bucket: process.env.bucket_name,
    metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
        const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
        const fullPath = `${folderName}/${fileName}`;
        cb(null, fullPath);
    }
});
const Storage = multerS3({
    s3: s3,
    bucket: process.env.bucket_name,
    metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
        const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
        const fullPath = `${folderName}/${fileName}`;
        cb(null, fullPath);
    }
});

var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array("file", 100);
var uploadP = multer({
    storage: Storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).single("file");


//Get dashbaord value for order and claims
exports.getDashboardData = async (req, res) => {
    try {
        let data = req.body;
        let project = {
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            unique_key_number: 1,
            unique_key_search: 1,
            servicerId: 1,
            customerId: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            venderOrder: 1,
            orderAmount: 1,
        };

        let query = { status: 'Active' };
        var checkOrders_ = await orderService.getDashboardData(query, project)
        let claimQuery = [
            {
                $match: { claimFile: 'Completed' }
            },
            {
                "$group": {
                    "_id": "",
                    "totalAmount": {
                        "$sum": {
                            "$sum": "$totalAmount"
                        }
                    },
                },

            },
        ]

        let valueClaim = await claimService.getClaimWithAggregate(claimQuery);
        let numberOfClaims = await claimService.getClaims({ claimFile: 'Completed' });
        if (!checkOrders_[0] && numberOfClaims.length == 0 && valueClaim[0]?.totalAmount == 0) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch order data",
                result: {
                    claimData: claimData,
                    orderData: {
                        "_id": "",
                        "totalAmount": 0,
                        "totalOrder": 0
                    }
                }
            })
            return;
        }
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim[0]?.totalAmount
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: {
                claimData: claimData,
                orderData: checkOrders_[0]
            }
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};


//Cron job for status
exports.cronJobStatus = async (req, res) => {
    try {
        let query = { status: { $ne: "Archieved" } };
        let data = req.body;
        let currentDate = new Date();
        let endOfDay = new Date();
        endOfDay.setDate(endOfDay.getDate() + 1); // Move to the next day
        endOfDay.setHours(0, 0, 0, 0);
        let lookupQuery = [
            {
                $match: query // Your match condition here
            },
            {
                $addFields: {
                    productsArray: {
                        $map: {
                            input: "$productsArray", // Input array
                            as: "product",
                            in: {
                                $mergeObjects: [
                                    "$$product",
                                    {
                                        ExpiredCondition: { $lt: ["$$product.coverageEndDate", endOfDay] },
                                        WaitingCondition: { $gt: ["$$product.coverageStartDate", currentDate] },
                                        ActiveCondition: {
                                            $and: [
                                                { $lte: ["$$product.coverageStartDate", currentDate] }, // Current date is greater than or equal to coverageStartDate
                                                { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $sort: { unique_key: -1 } // Sorting if required
            },
            {
                $project: {
                    productsArray: 1,
                    _id: 0 // Exclude the _id field if necessary
                }
            }
        ];
        let ordersResult = await orderService.getAllOrders1(lookupQuery);

        let bulk = []
        for (let i = 0; i < ordersResult.length; i++) {
            for (let j = 0; j < ordersResult[i].productsArray.length; j++) {
                let status = ''
                let eligibilty;
                let product = ordersResult[i].productsArray[j];
                let orderProductId = product._id
                let claimStatus = new Date(product.coverageStartDate) > new Date() ? "Waiting" : "Active"
                claimStatus = new Date(product.coverageEndDate) < new Date() ? "Expired" : claimStatus
                if (claimStatus == 'Expired') {
                    eligibilty = false;
                    status = 'Expired'
                }
                if (claimStatus == 'Waiting') {
                    eligibilty = false;
                    status = 'Waiting'
                }
                if (claimStatus == 'Active') {
                    status = 'Active'
                    eligibilty = true;
                }
                let updateDoc = {
                    'updateMany': {
                        'filter': { 'orderProductId': orderProductId },
                        update: { $set: { status: status, eligibilty: eligibilty } },
                        'upsert': false
                    }
                }
                bulk.push(updateDoc)
            }
        }
        const result = await contractService.allUpdate(bulk);

        res.send({
            code: constant.successCode,
            //result:bulk
            result
        })

    }
    catch (err) {
        res.send({
            message: err.message
        })
    }
};

// update the eligibility statuses (cron job function)
exports.cronJobStatusWithDate = async (req, res) => {
    try {
        const startDate = new Date(req.body.startDate)
        const endDate = new Date(req.body.endDate)
        let currentDate = new Date();
        const orderID = req.body.orderId;
        const orderProductId = req.body.orderProductId;
        const newValue = {
            $set: {
                "productsArray.$.coverageStartDate": startDate,
                "productsArray.$.coverageEndDate": endDate,
            }
        };
        let update = await orderService.updateOrder({ _id: orderID, "productsArray._id": orderProductId }, {
            $set: {
                "productsArray.$.coverageStartDate": req.body.startDate,
                "productsArray.$.coverageEndDate": req.body.endDate,
            }
        }, { multi: true })
        let query = { status: { $ne: "Archieved" } };
        let data = req.body;
        let endOfDay = new Date();
        endOfDay.setDate(endOfDay.getDate() + 1); // Move to the next day
        let lookupQuery = [
            {
                $match: query // Your match condition here 
            },
            {
                $addFields: {
                    productsArray: {
                        $map: {
                            input: "$productsArray", // Input array
                            as: "product",
                            in: {
                                $mergeObjects: [
                                    "$$product",
                                    {
                                        ExpiredCondition: { $lt: ["$$product.coverageEndDate", currentDate] },
                                        // ExpiredCondition: { $and: [
                                        //     { $lt: ["$$product.coverageEndDate", endOfDay] }, // Current date is greater than or equal to coverageStartDate
                                        //     { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                        // ] },

                                        WaitingCondition: { $gt: ["$$product.coverageStartDate", currentDate] },
                                        ActiveCondition: {
                                            $and: [
                                                { $lte: ["$$product.coverageStartDate", currentDate] }, // Current date is greater than or equal to coverageStartDate
                                                { $gte: ["$$product.coverageEndDate", currentDate] }    // Current date is less than or equal to coverageEndDate
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $sort: { unique_key: -1 } // Sorting if required
            },
            {
                $project: {
                    productsArray: 1,
                    _id: 0 // Exclude the _id field if necessary
                }
            }
        ];
        let ordersResult = await orderService.getAllOrders1(lookupQuery);

        let bulk = []
        for (let i = 0; i < ordersResult.length; i++) {
            for (let j = 0; j < ordersResult[i].productsArray.length; j++) {
                let status = ''
                let eligibilty;
                let product = ordersResult[i].productsArray[j];
                let orderProductId = product._id

                if (product.ExpiredCondition) {
                    eligibilty = false;
                    status = 'Expired'
                }
                if (product.WaitingCondition) {
                    eligibilty = false;
                    status = 'Waiting'
                }
                if (product.ActiveCondition) {
                    status = 'Active'
                    eligibilty = true;
                }
                let updateDoc = {
                    'updateMany': {
                        'filter': { 'orderProductId': orderProductId },
                        update: { $set: { status: status, eligibilty: eligibilty } },
                        'upsert': false
                    }
                }
                bulk.push(updateDoc)
            }
        }
        res.send({
            code: constant.successCode,
            //result:bulk
            bulk
        })
        return;
    }
    catch (err) {
        res.send({
            message: err.message
        })
    }
};

//Generate T and C
async function generateTC(orderData) {
    try {
        let response;
        let link;
        const checkOrder = await orderService.getOrder({ _id: orderData._id }, { isDeleted: false })
        let coverageStartDate = checkOrder.productsArray[0]?.coverageStartDate;
        let coverageEndDate = checkOrder.productsArray[0]?.coverageEndDate;
        //Get Dealer
        const checkDealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: false })
        //Get customer
        const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: false })
        //Get customer primary info
        const customerUser = await userService.getUserById1({ metaId: checkOrder.customerId, isPrimary: true }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            if (!item.exit) return contractService.getContractById({
                orderProductId: item._id
            });
            else {
                return null;
            }
        })
        const contractArray = await Promise.all(contractArrayPromise);

        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: quanitityProduct.name,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract.productName,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaId: checkOrder.servicerId, isPrimary: true }, { isDeleted: false })
        //res.json(checkDealer);return
        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm',
            childProcessOptions: {
                env: {
                    OPENSSL_CONF: '/dev/null',
                },
            }
        }
        let mergeFileName = checkOrder.unique_key + '.pdf'
        //  const orderFile = 'pdfs/' + mergeFileName;
        const orderFile = `/tmp/${mergeFileName}`; // Temporary local storage
        const html = `<head>
        <link rel="stylesheet" href="https://gistcdn.githack.com/mfd/09b70eb47474836f25a21660282ce0fd/raw/e06a670afcb2b861ed2ac4a1ef752d062ef6b46b/Gilroy.css"></link>
        </head>
        <table border='1' border-collapse='collapse' style=" border-collapse: collapse; font-size:13px;font-family:  'Gilroy', sans-serif;">
                            <tr>
                                <td style="width:50%; font-size:13px;padding:15px;">  GET COVER service contract number:</td>
                                <td style="font-size:13px;">${checkOrder.unique_key}</td>
                            </tr>
                            <tr>
                                <td style="font-size:13px;padding:15px;">${checkReseller ? "Reseller Name" : "Dealer Name"}:</td>
                                <td style="font-size:13px;"> 
                                    <p><b>Attention –</b> ${checkReseller ? checkReseller.name : checkDealer.name}</p>
                                    <p> <b>Email Address – </b>${resellerUser ? resellerUser?.email : DealerUser.email}</p>
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''}, ${checkCustomer ? checkCustomer?.city : ''}, ${checkCustomer ? checkCustomer?.state : ''}, ${checkCustomer ? checkCustomer?.country : ''}</td>
                   </tr>
                <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${checkOrder.productsArray[0]?.term / 12} 
                ${checkOrder.productsArray[0]?.term / 12 === 1 ? 'Year' : 'Years'}
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${moment(coverageEndDate).format("MM/DD/YYYY")}</td>
          </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">Number of covered components:</td>
               <td> ${tableRows}   </td>                 
            </tr >
            
        </table > `;

        pdf.create(html, options).toFile(orderFile, async (err, result) => {
            if (err) return console.log(err);
            const { PDFDocument, rgb } = require('pdf-lib');
            const fs = require('fs').promises;
            const fileContent = await fs.readFile(orderFile);
            const bucketName = process.env.bucket_name
            const s3Key = `pdfs/${mergeFileName}`;
            //Upload to S3 bucket
            await uploadToS3(orderFile, bucketName, s3Key);
            const termConditionFile = checkOrder.termCondition.fileName ? checkOrder.termCondition.fileName : "file-1723185474819.pdf"
            const termPath = termConditionFile
            const termPathBucket = await downloadFromS3(bucketName, termPath);
            const orderPathBucket = await downloadFromS3(bucketName, s3Key);
            async function mergePDFs(pdfBytes1, pdfBytes2, outputPath) {
                const pdfDoc1 = await PDFDocument.load(pdfBytes1);
                const pdfDoc2 = await PDFDocument.load(pdfBytes2);

                const mergedPdf = await PDFDocument.create();

                const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                const mergedPdfBytes = await mergedPdf.save();

                await fs.writeFile(outputPath, mergedPdfBytes);
                return mergedPdfBytes;
            }
            // Merge PDFs
            const mergedPdf = await mergePDFs(termPathBucket, orderPathBucket, `/tmp/merged_${mergeFileName}`);
            // Upload merged PDF to S3
            const mergedKey = `mergedFile/${mergeFileName}`;
            await uploadToS3(`/tmp/merged_${mergeFileName}`, bucketName, mergedKey);
            const params = {
                Bucket: bucketName,
                Key: `mergedFile/${mergeFileName}`
            };
            //Read from the s3 bucket
            const data = await S3.getObject(params).promise();
            let attachment = data.Body.toString('base64');
            //sendTermAndCondition
            // Send Email code here
            let notificationEmails = await supportingFunction.getUserEmails();
            notificationEmails.push(DealerUser.email)
            notificationEmails.push(resellerUser?.email)
            let emailData = {
                senderName: customerUser.firstName,
                content: "Please read the following terms and conditions for your order. If you have any questions, feel free to reach out to our support team.",
                subject: 'Order Term and Condition-' + checkOrder.unique_key,
            }
            let mailing = await sgMail.send(emailConstant.sendTermAndCondition(customerUser.email, notificationEmails, emailData, attachment))
        })
        return 1

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
}

//Generate HTML to PDF
exports.generateHtmltopdf = async (req, res) => {
    try {
        let response;
        let link;
        const checkOrder = await orderService.getOrder({ _id: req.params.orderId }, { isDeleted: false })
        let coverageStartDate = checkOrder.productsArray[0]?.coverageStartDate;
        let coverageEndDate = checkOrder.productsArray[0]?.coverageEndDate;
        //Get Dealer
        const checkDealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: false })
        //Get customer
        const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: false })
        //Get customer primary info
        const customerUser = await userService.getUserById1({ metaId: checkOrder.customerId, isPrimary: true }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            if (!item.exit) return contractService.getContractById({
                orderProductId: item._id
            });
            else {
                return null;
            }
        })
        const contractArray = await Promise.all(contractArrayPromise);
        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: quanitityProduct.name,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract.productName,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        // res.json(productCoveredArray);
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaId: checkOrder.servicerId, isPrimary: true }, { isDeleted: false })
        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm',
            childProcessOptions: {
                env: {
                    OPENSSL_CONF: '/dev/null',
                },
            }
        }
        let mergeFileName = checkOrder.unique_key + '.pdf'
        //  const orderFile = 'pdfs/' + mergeFileName;
        const orderFile = `/tmp/${mergeFileName}`; // Temporary local storage
        const html = `<head>
        <link rel="stylesheet" href="https://gistcdn.githack.com/mfd/09b70eb47474836f25a21660282ce0fd/raw/e06a670afcb2b861ed2ac4a1ef752d062ef6b46b/Gilroy.css"></link>
        </head>
        <table border='1' border-collapse='collapse' style=" border-collapse: collapse; font-size:13px;font-family:  'Gilroy', sans-serif;">
                            <tr>
                                <td style="width:50%; font-size:13px;padding:15px;">  GET COVER service contract number:</td>
                                <td style="font-size:13px;">${checkOrder.unique_key}</td>
                            </tr>
                            <tr>
                                <td style="font-size:13px;padding:15px;">${checkReseller ? "Reseller Name" : "Dealer Name"}:</td>
                                <td style="font-size:13px;"> 
                                    <p><b>Attention –</b> ${checkReseller ? checkReseller.name : checkDealer.name}</p>
                                    <p> <b>Email Address – </b>${resellerUser ? resellerUser?.email : DealerUser.email}</p>
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''},${checkCustomer ? checkCustomer?.city : ''},${checkCustomer ? checkCustomer?.state : ''}</td>
                   </tr>
                <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${checkOrder.productsArray[0]?.term / 12} 
                ${checkOrder.productsArray[0]?.term / 12 === 1 ? 'Year' : 'Years'}
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${moment(coverageEndDate).format("MM/DD/YYYY")}</td>
          </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">Number of covered components:</td>
               <td> ${tableRows}   </td>                 
            </tr >
            
        </table > `;
        const checkFileExist = await checkFileExistsInS3(process.env.bucket_name, `mergedFile/${mergeFileName}`)
        if (checkFileExist) {
            // link = `${process.env.SITE_URL}:3002/uploads/" + "mergedFile/` + mergeFileName;
            response = { link: link, fileName: mergeFileName, bucketName: process.env.bucket_name, key: "mergedFile" }
            res.send({
                code: constant.successCode,
                message: 'Success!',
                result: response
            })
        } else {
            pdf.create(html, options).toFile(orderFile, async (err, result) => {
                if (err) return console.log(err);
                const { PDFDocument, rgb } = require('pdf-lib');
                const fs = require('fs').promises;
                const fileContent = await fs.readFile(orderFile);
                const bucketName = process.env.bucket_name
                const s3Key = `pdfs/${mergeFileName}`;
                await uploadToS3(orderFile, bucketName, s3Key);
                const termConditionFile = checkOrder.termCondition.fileName ? checkOrder.termCondition.fileName : "file-1723185474819.pdf"
                const termPath = termConditionFile
                const termPathBucket = await downloadFromS3(bucketName, termPath);
                const orderPathBucket = await downloadFromS3(bucketName, s3Key);
                async function mergePDFs(pdfBytes1, pdfBytes2, outputPath) {
                    const pdfDoc1 = await PDFDocument.load(pdfBytes1);
                    const pdfDoc2 = await PDFDocument.load(pdfBytes2);

                    const mergedPdf = await PDFDocument.create();

                    const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                    pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                    const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                    pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                    const mergedPdfBytes = await mergedPdf.save();

                    await fs.writeFile(outputPath, mergedPdfBytes);
                    return mergedPdfBytes;
                }
                // Merge PDFs
                const mergedPdf = await mergePDFs(termPathBucket, orderPathBucket, `/tmp/merged_${mergeFileName}`);
                // Upload merged PDF to S3
                const mergedKey = `mergedFile/${mergeFileName}`;
                await uploadToS3(`/tmp/merged_${mergeFileName}`, bucketName, mergedKey);
                response = { link: link, fileName: mergeFileName, bucketName: process.env.bucket_name, key: "mergedFile" }

                res.send({
                    code: constant.successCode,
                    message: 'Success!',
                    result: response
                })

            });
        }

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
}

//check file exist in S3 bucket
const checkFileExistsInS3 = async (bucketName, key) => {
    try {
        await S3.headObject({ Bucket: bucketName, Key: key }).promise();
        return true; // File exists
    } catch (err) {
        if (err.code === 'NotFound') {
            return false; // File does not exist
        }
        throw err; // Some other error occurred
    }
};

//Upload to S3
const uploadToS3 = async (filePath, bucketName, key) => {
    const fs = require('fs').promises;
    const fileContent = await fs.readFile(filePath);
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
    };
    return S3.upload(params).promise();
};

//Download to S3
const downloadFromS3 = async (bucketName, key) => {
    const params = {
        Bucket: bucketName,
        Key: key,
    };
    const data = await S3.getObject(params).promise();
    return data.Body;
};
// reporting data creating script for all orders 
exports.reportingDataCreation = async (req, res) => {
    try {
        let getAllOrders = await orderService.getAllOrders1([
            {
                $match: { "status": "Active" }
            }
        ])
        if (!getAllOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the orders"
            })
        }

        let reportingToSave = []

        for (let i = 0; i < getAllOrders.length; i++) {
            let orderData = getAllOrders[i]


            let checkOrderId = await supportingFunction.checkReportinWithId({ orderId: orderData._id })
            if (!checkOrderId) {
                let reportingData = {}
                let products = []
                reportingData.orderId = orderData._id
                reportingData.orderAmount = orderData.orderAmount
                reportingData.dealerId = orderData.dealerId
                reportingData.createdAt = orderData.updatedAt
                reportingData.updatedAt = orderData.updatedAt

                for (let p = 0; p < orderData.productsArray.length; p++) {
                    productData = orderData.productsArray[p]
                    let productObject = {}
                    productObject.price = productData.price
                    productObject.noOfProducts = productData.checkNumberProducts
                    productObject.retailPrice = productData.dealerPriceBookDetails.retailPrice
                    productObject.frontingFee = productData.priceBookDetails.frontingFee
                    productObject.reserveFutureFee = productData.priceBookDetails.reserveFutureFee
                    productObject.reinsuranceFee = productData.priceBookDetails.reinsuranceFee
                    productObject._id = productData.priceBookDetails._id
                    productObject.name = productData.priceBookDetails.name
                    productObject.categoryId = productData.priceBookDetails.category
                    productObject.term = productData.priceBookDetails.term
                    productObject.adminFee = productData.priceBookDetails.adminFee
                    productObject.brokerFee = productData.dealerPriceBookDetails.brokerFee
                    productObject.dealerPriceId = productData.dealerPriceBookDetails._id
                    products.push(productObject)

                }
                reportingData.products = products
                reportingToSave.push(reportingData)
            }
        }
        console.log("check++++++++++++++++++++++++++", reportingToSave)
        let saveData = await supportingFunction.insertManyReporting(reportingToSave)
        if (saveData) {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "order/editOrderDetail catch",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

// reporting data recreation for the missing orders(order with no reporting data)
exports.reportingDataReCreation = async (req, res) => {
    try {

        let getReportings = await supportingFunction.checkReporting()
        let orderId = getReportings.map(ID => new mongoose.Types.ObjectId(ID.orderId))

        let getAllOrders = await orderService.getAllOrders1([
            {
                $match: {
                    $and: [
                        { _id: { $nin: orderId } },
                        { "status": "Active" }
                    ]
                }
            }
        ])

        if (!getAllOrders) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the orders"
            })
        }

        let reportingToSave = []
        for (let i = 0; i < getAllOrders.length; i++) {
            let orderData = getAllOrders[i]
            let checkOrderId = await supportingFunction.checkReportinWithId({ orderId: orderData._id })
            if (!checkOrderId) {
                let reportingData = {}
                let products = []
                reportingData.orderId = orderData._id
                reportingData.orderAmount = orderData.orderAmount
                reportingData.dealerId = orderData.dealerId
                reportingData.createdAt = orderData.updatedAt
                reportingData.updatedAt = orderData.updatedAt

                for (let p = 0; p < orderData.productsArray.length; p++) {
                    productData = orderData.productsArray[p]
                    let productObject = {}
                    productObject.price = productData.price
                    productObject.noOfProducts = productData.checkNumberProducts
                    productObject.retailPrice = productData.dealerPriceBookDetails.retailPrice
                    productObject.frontingFee = productData.priceBookDetails.frontingFee
                    productObject.reserveFutureFee = productData.priceBookDetails.reserveFutureFee
                    productObject.reinsuranceFee = productData.priceBookDetails.reinsuranceFee
                    productObject._id = productData.priceBookDetails._id
                    productObject.name = productData.priceBookDetails.name
                    productObject.categoryId = productData.priceBookDetails.category
                    productObject.term = productData.priceBookDetails.term
                    productObject.adminFee = productData.priceBookDetails.adminFee
                    productObject.brokerFee = productData.dealerPriceBookDetails.brokerFee
                    productObject.dealerPriceId = productData.dealerPriceBookDetails._id
                    products.push(productObject)

                }
                reportingData.products = products
                reportingToSave.push(reportingData)
            }
        }

        let saveData = await supportingFunction.insertManyReporting(reportingToSave)
        if (saveData) {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "order/editOrderDetail catch",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Get servicer in orders
exports.getServicerInOrders = async (req, res) => {
    let data = req.body;
    let servicer = [];
    if (data.dealerId) {
        var checkDealer = await dealerService.getDealerById(data.dealerId, {
            isDeleted: 0,
        });
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found!",
            });
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({
            dealerId: data.dealerId,
        });
        let ids = getServicersIds.map((item) => item.servicerId);

        servicer = await servicerService.getAllServiceProvider(
            { _id: { $in: ids }, status: true },
            {}
        );

        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers",
            });
            return;
        }
    }
    if (data.resellerId) {
        var checkReseller = await resellerService.getReseller({
            _id: data.resellerId,
        });
    }
    if (checkReseller && checkReseller.isServicer) {
        //Get the servicer name if reseller as servicer
        const checkServicer = await servicerService.getServiceProviderById({ resellerId: checkReseller._id })
        if (checkReseller.status) {
            servicer.unshift(checkReseller);
        }
    }

    if (checkDealer && checkDealer.isServicer) {
        //Get the servicer name if dealer as servicer
        const checkServicer = await servicerService.getServiceProviderById({ dealerId: checkDealer._id })
        if (checkDealer.accountStatus) {
            servicer.unshift(checkDealer);
        }
    }

    const servicerIds = servicer.map((obj) => obj?._id);
    const resellerIdss = servicer.map((obj) => obj?.resellerId);
    const dealerIdss = servicer.map((obj) => obj?.dealerId);
    const query1 = {
        $and: [
            {
                $or: [
                    { metaId: { $in: servicerIds } },
                    { metaId: { $in: resellerIdss } },
                    { metaId: { $in: dealerIdss } },
                ]
            },
            { isPrimary: true }
        ]
    };

    let servicerUser = await userService.getMembers(query1, {});
    if (!servicerUser) {
        res.send({
            code: constant.errorCode,
            message: "Unable to fetch the data",
        });
        return;
    }


    const result_Array = servicer.map((item1) => {
        const matchingItem = servicerUser.find(
            (item2) => item2.metaId.toString() === item1?._id.toString());
        let matchingItem2 = servicerUser.find(
            (item2) => item2.metaId.toString() === item1?.resellerId?.toString() || item2.metaId.toString() === item1?.dealerId?.toString());
        if (matchingItem) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem.toObject(),
            };
        } else if (matchingItem2) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem2.toObject(),
            };
        } else {
            return {}
        }
    });

    res.send({
        code: constant.successCode,
        result: result_Array,
    });
};

//Get Dealer Resellers
exports.getDealerResellers = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.body.dealerId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.body.dealerId, status: true }
        let projection = { __v: 0 }
        const resellers = await resellerService.getResellers(query, projection);
        if (!resellers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the resellers"
            });
            return;
        };


        const resellerId = resellers.map(obj => obj._id);

        const orderResellerId = resellers.map(obj => obj._id);
        const queryUser = { metaId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

        //Get Dealer Customer Orders

        let project = {
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            servicerId: 1,
            customerId: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            venderOrder: 1,
            orderAmount: 1,
        }

        let orderQuery = {
            $and: [
                { resellerId: { $in: orderResellerId }, status: "Active" },
            ]
        }
        let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$resellerId');

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.metaId.toString())

            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orderData: order ? order : {}
                };
            } else {
                return {};
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.resellerData.dealerId) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};