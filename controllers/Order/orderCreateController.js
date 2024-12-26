
require("dotenv").config()
const orderService = require("../../services/Order/orderService");
const supportingFunction = require('../../config/supportingFunction')
const LOG = require('../../models/User/logs')
const emailConstant = require('../../config/emailConstant');
const dealerService = require("../../services/Dealer/dealerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const resellerService = require("../../services/Dealer/resellerService");
const servicerService = require("../../services/Provider/providerService");
const contractService = require("../../services/Contract/contractService");
const customerService = require("../../services/Customer/customerService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const userService = require("../../services/User/userService");
const claimService = require("../../services/Claim/claimService");
const pdf = require('html-pdf');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const constant = require("../../config/constant");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const XLSX = require("xlsx");
const fs = require("fs");
const moment = require("moment");
const PDFDocument = require('pdfkit');
const { S3Client } = require('@aws-sdk/client-s3');
const AWS = require('aws-sdk');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const S3 = new aws.S3();

aws.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
});
const S3Bucket = new aws.S3();
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
        console.log("fullPath----------------", fullPath)
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

const kkkk = new AWS.S3({
    region: process.env.region,
    credentials: {
        accessKeyId: process.env.aws_access_key_id,
        secretAccessKey: process.env.aws_secret_access_key,
    }// Your AWS region
});

//check file validation for orders
exports.checkFileValidation = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            let data = req.body;
            let file = req.file;
            let csvName = file.key;
            let originalName = file.originalname;
            let size = file.size;
            let totalDataComing1 = [];
            let message = [];
            let ws;
            //S3 Bucket Read Code
            var params = { Bucket: process.env.bucket_name, Key: file.key };
            S3Bucket.getObject(params, function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    if (!Buffer.isBuffer(data.Body)) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to buffer try again"
                        })
                        return
                    }
                    // Parse the buffer as an Excel file
                    const wb = XLSX.read(data.Body, { type: 'buffer' });
                    // Extract the data from the first sheet
                    const sheetName = wb.SheetNames[0];
                    ws = wb.Sheets[sheetName];
                    totalDataComing1 = XLSX.utils.sheet_to_json(ws);
                    const headers = [];
                    for (let cell in ws) {
                        // Check if the cell is in the first row and has a non-empty value
                        if (
                            /^[A-Z]1$/.test(cell) &&
                            ws[cell].v !== undefined &&
                            ws[cell].v !== null &&
                            ws[cell].v.trim() !== ""
                        ) {
                            headers.push(ws[cell].v);
                        }
                    }

                    if (headers.length !== 8) {
                        // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                        res.send({
                            code: constant.successCode,
                            message:
                                "Invalid file format detected. The sheet should contain exactly eight columns.",
                            orderFile: {
                                fileName: csvName,
                                name: originalName,
                                size: file.size,
                            },
                        });
                        return;
                    }

                    const isValidLength = totalDataComing1.every(
                        (obj) => Object.keys(obj).length === 8
                    );
                    if (!isValidLength) {
                        res.send({
                            code: constant.successCode,
                            message: "Invalid fields value",
                            orderFile: {
                                fileName: csvName,
                                name: originalName,
                                size: size,
                            },
                        });
                        return;
                    }
                    const totalDataComing = totalDataComing1.map((item) => {
                        const keys = Object.keys(item);
                        return {
                            retailValue: item[keys[4]],
                        };
                    });

                    const serialNumberArray = totalDataComing1.map((item) => {
                        const keys = Object.keys(item);
                        return {
                            serial: item[keys[2]].toString().toLowerCase(),
                        };
                    });

                    const serialNumbers = serialNumberArray.map(number => number.serial);
                    const duplicateSerials = serialNumbers.filter((serial, index) => serialNumbers.indexOf(serial) !== index);

                    if (duplicateSerials.length > 0) {
                        res.send({
                            code: constant.successCode,
                            message: "Serial numbers are not unique for this product",
                            orderFile: {
                                fileName: csvName,
                                name: originalName,
                                size: size,
                            },
                        })
                        return
                    }

                    // Check retail price is in between rangeStart and rangeEnd
                    const isValidRetailPrice = totalDataComing.map((obj) => {
                        // Check if 'noOfProducts' matches the length of 'data'
                        if (
                            obj.retailValue < Number(data.rangeStart) ||
                            obj.retailValue > Number(data.rangeEnd)
                        ) {
                            message.push({
                                code: constant.successCode,
                                retailPrice: obj.retailValue,
                                message: "Invalid Retail Price!",
                                fileName: csvName,
                                name: originalName,
                                orderFile: {
                                    fileName: csvName,
                                    name: originalName,
                                    size: size,
                                },
                            });
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            data: message,

                        });
                        return;
                    }

                    res.send({
                        code: constant.successCode,
                        message: "Verified",
                        orderFile: {
                            fileName: csvName,
                            name: originalName,
                            size: size,
                        },
                    });
                }
            })

        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
}

//check file validation for orders
// exports.checkFileValidation = async (req, res) => {
//     try {
//         uploadP(req, res, async (err) => {
//             let data = req.body;
//             let file = req.file;
//             let csvName = file.key;
//             let originalName = file.originalname;
//             let size = file.size;
//             let totalDataComing1 = [];
//             let ws;
//             //S3 Bucket Read Code
//             var params = { Bucket: process.env.bucket_name, Key: file.key };
//             S3Bucket.getObject(params, function (err, data) {
//                 if (err) {
//                     console.log(err);
//                 } else {
//                     if (!Buffer.isBuffer(data.Body)){
//                         resse
//                     }
//                     // Parse the buffer as an Excel file
//                     const wb = XLSX.read(data.Body, { type: 'buffer' });
//                     // Extract the data from the first sheet
//                     const sheetName = wb.SheetNames[0];
//                     ws = wb.Sheets[sheetName];
//                     totalDataComing1 = XLSX.utils.sheet_to_json(ws);
//                     const headers = [];
//                     for (let cell in ws) {
//                         // Check if the cell is in the first row and has a non-empty value
//                         if (
//                             /^[A-Z]1$/.test(cell) &&
//                             ws[cell].v !== undefined &&
//                             ws[cell].v !== null &&
//                             ws[cell].v.trim() !== ""
//                         ) {
//                             headers.push(ws[cell].v);
//                         }
//                     }

//                     if (headers.length !== 8) {
//                         // fs.unlink('../../uploads/orderFile/' + req.file.filename)
//                         res.send({
//                             code: constant.successCode,
//                             message:
//                                 "Invalid file format detected. The sheet should contain exactly eight columns.",
//                             orderFile: {
//                                 fileName: csvName,
//                                 name: originalName,
//                                 size: file.size,
//                             },
//                         });
//                         return;
//                     }

//                     const isValidLength = totalDataComing1.every(
//                         (obj) => Object.keys(obj).length === 5
//                     );
//                     if (!isValidLength) {
//                         res.send({
//                             code: constant.successCode,
//                             message: "Invalid fields value",
//                             orderFile: {
//                                 fileName: csvName,
//                                 name: originalName,
//                                 size: size,
//                             },
//                         });
//                         return;
//                     }
//                     const totalDataComing = totalDataComing1.map((item) => {
//                         const keys = Object.keys(item);
//                         return {
//                             retailValue: item[keys[4]],
//                         };
//                     });

//                     const serialNumberArray = totalDataComing1.map((item) => {
//                         const keys = Object.keys(item);
//                         return {
//                             serial: item[keys[2]].toString().toLowerCase(),
//                         };
//                     });

//                     const serialNumbers = serialNumberArray.map(number => number.serial);
//                     const duplicateSerials = serialNumbers.filter((serial, index) => serialNumbers.indexOf(serial) !== index);

//                     if (duplicateSerials.length > 0) {
//                         res.send({
//                             code: constant.successCode,
//                             message: "Serial numbers are not unique for this product",
//                             orderFile: {
//                                 fileName: csvName,
//                                 name: originalName,
//                                 size: size,
//                             },
//                         })
//                         return
//                     }

//                     // Check retail price is in between rangeStart and rangeEnd
//                     const isValidRetailPrice = totalDataComing.map((obj) => {
//                         // Check if 'noOfProducts' matches the length of 'data'
//                         if (
//                             obj.retailValue < Number(data.rangeStart) ||
//                             obj.retailValue > Number(data.rangeEnd)
//                         ) {
//                             message.push({
//                                 code: constant.successCode,
//                                 retailPrice: obj.retailValue,
//                                 message: "Invalid Retail Price!",
//                                 fileName: csvName,
//                                 name: originalName,
//                                 orderFile: {
//                                     fileName: csvName,
//                                     name: originalName,
//                                     size: size,
//                                 },
//                             });
//                         }
//                     });

//                     if (message.length > 0) {
//                         res.send({
//                             data: message,

//                         });
//                         return;
//                     }

//                     res.send({
//                         code: constant.successCode,
//                         message: "Verified",
//                         orderFile: {
//                             fileName: csvName,
//                             name: originalName,
//                             size: size,
//                         },
//                     });
//                 }
//             })

//         });
//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message,
//         });
//     }
// };

//checking uploaded file is valid
exports.checkMultipleFileValidation = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body;
            if (data.productsArray.length > 0) {
                let fileIndex = 0;
                const productsWithFiles = data.productsArray.map((data1, index) => {
                    let file1 = undefined; // Initialize file to undefined
                    if (data1.fileValue == 'true') {
                        let checkFile = JSON.parse(data1.orderFile)
                        // Check if data1.file is not blank
                        file1 = { Bucket: process.env.bucket_name, Key: checkFile.fileName };
                        fileIndex++;
                    }
                    return {
                        products: {
                            key: index,
                            checkNumberProducts: data1.checkNumberProducts,
                            noOfProducts: data1.noOfProducts,
                            priceType: data1.priceType,
                            rangeStart: data1.rangeStart,
                            rangeEnd: data1.rangeEnd,
                            flag: data1.fileValue, // Set flag based on whether data1.file is not blank
                            file: file1
                        },
                    };
                });
                let allHeaders = [];
                let allDataComing = [];
                let message = [];
                const headers = [];
                //Collect all header length for all csv
                for (let j = 0; j < productsWithFiles.length; j++) {
                    if (productsWithFiles[j].products.file != undefined) {
                        const bucketReadUrl = productsWithFiles[j].products.file
                        // Await the getObjectFromS3 function to complete
                        const result = await getObjectFromS3(bucketReadUrl);

                        allDataComing.push({
                            key: productsWithFiles[j].products.key,
                            checkNumberProducts: productsWithFiles[j].products.checkNumberProducts,
                            noOfProducts: productsWithFiles[j].products.noOfProducts,
                            priceType: productsWithFiles[j].products.priceType,
                            rangeStart: productsWithFiles[j].products.rangeStart,
                            rangeEnd: productsWithFiles[j].products.rangeEnd,
                            data: result.data,
                        });

                        allHeaders.push({
                            key: productsWithFiles[j].products.key,
                            headers: result.headers,
                        });

                    }
                }
                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 8)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly eight columns.",
                    }));
                if (errorMessages.length > 0) {
                    // There are errors, send the error messages
                    res.send({
                        code: constant.errorCode,
                        message: errorMessages,
                    });
                    return;
                }
                if (allDataComing.length > 0) {
                    const isValidLength1 = allDataComing.map((obj) => {
                        if (!obj.data || typeof obj.data !== "object") {
                            return false; // 'data' should be an object
                        }
                        const orderFileData = obj.data.map(item => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });

                        orderFileData.forEach((fileData) => {
                            let brand = fileData.brand.toString().replace(/\s+/g, ' ').trim()
                            let serial = fileData.serial.toString().replace(/\s+/g, ' ').trim()
                            let condition = fileData.condition.toString().replace(/\s+/g, ' ').trim()
                            let retailValue = fileData.retailValue.toString().replace(/\s+/g, ' ').trim()
                            let partsWarranty = fileData.partsWarranty.toString().replace(/\s+/g, ' ').trim()
                            let labourWarranty = fileData.labourWarranty.toString().replace(/\s+/g, ' ').trim()
                            let purchaseDate = fileData.purchaseDate.toString().replace(/\s+/g, ' ').trim()
                            let model = fileData.model.toString().replace(/\s+/g, ' ').trim()

                            if (brand == '' || serial == '' || condition == '' || retailValue == '' || model == '' || partsWarranty == '' || labourWarranty == '' || purchaseDate == "") {
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid fields value",
                                });

                                return;

                            }
                        });
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }
                    let serialNumber = allDataComing.map((obj) => {
                        const serialNumberArray = obj.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj.key,
                                serialNumber: item[keys[2]],
                                retailValue: item[keys[4]]
                            };
                        });

                        if (serialNumberArray.length > 0) {
                            const seen = new Set();
                            const duplicates = [];
                            for (const { key, serialNumber } of serialNumberArray) {
                                const keySerialPair = `${key}-${serialNumber}`;
                                if (seen.has(keySerialPair)) {
                                    message.push({
                                        code: 401,
                                        key: key,
                                        message: "Serial numbers are not unique for this product"
                                    });
                                    return
                                } else {
                                    seen.add(keySerialPair);

                                }
                            }
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                    //Check if csv data length equal to no of products
                    const isValidNumberData = allDataComing.map((obj) => {
                        if (obj.priceType == "Quantity Pricing") {
                            if (parseInt(obj.checkNumberProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                //return; // Set the return value to false when the condition fails
                            }
                        } else {
                            if (parseInt(obj.noOfProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                // return; // Set the return value to false when the condition fails
                            }
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let checkRetailValue = allDataComing.map((obj1) => {
                        const priceObj = obj1.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj1.key,
                                checkNumberProducts: obj1.checkNumberProducts,
                                noOfProducts: obj1.noOfProducts,
                                rangeStart: obj1.rangeStart,
                                rangeEnd: obj1.rangeEnd,
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        if (priceObj.length > 0) {
                            priceObj.map((obj, index) => {
                                //check Purchase date is valid or not
                                if (!isValidDate(obj.purchaseDate)) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: `Purchase date should be in the format MM/DD/YYYY `
                                    });
                                    return;
                                }
                                if (isNaN(obj.retailValue) || obj.retailValue < 0) {
                                    {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Retail Price should be integer and positive!!",
                                        });

                                        return;
                                    }
                                }
                                // check if the input value is a number
                                let p_warranty = Number(obj.partsWarranty)
                                let l_warranty = Number(obj.labourWarranty)

                                if (!isNaN(p_warranty) || !isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(p_warranty) || isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(new Date(obj.purchaseDate).getTime())) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'Invalid Date!'
                                    });
                                    return;
                                }
                                if (new Date(obj.purchaseDate) > new Date()) {

                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'The purchase date should be present date and past date!'
                                    });
                                    return;
                                }
                                if (obj1.priceType == 'Flat Pricing') {
                                    if (Number(obj.retailValue) < Number(obj.rangeStart) || Number(obj.retailValue) > Number(obj.rangeEnd)) {
                                        {
                                            message.push({
                                                code: constant.errorCode,
                                                key: obj.key,
                                                message: "Retail price should be between start and end range!",
                                            });

                                            return;
                                        }
                                    }
                                }
                            });
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }
                }
            }
            res.send({
                code: constant.successCode,
                message: "SuccessfileName!",
            });
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

//Check date is valid or not
function isValidDate(dateString) {
    // Check the format with a regular expression
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;

    if (!regex.test(dateString)) {
        return false;
    }

    // Parse the date parts to integers
    const [month, day, year] = dateString.split("/").map(Number);

    // Check if the date is valid using the Date object
    const date = new Date(year, month - 1, day);

    // Check if the date parts match the parsed date
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

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
        const customerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        let otherInfo = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            return contractService.getContractById({
                orderProductId: item._id
            });

        })
        const contractArray = await Promise.all(contractArrayPromise);

        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            let anotherObj = {
                coverageStartDate: checkOrder?.productsArray[i]?.coverageStartDate,
                coverageEndDate: checkOrder?.productsArray[i]?.coverageEndDate,
                term: checkOrder?.productsArray[i]?.term
            }
            otherInfo.push(anotherObj)
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: checkOrder?.productsArray[i]?.dealerSku,
                        noOfProducts: quanitityProduct.enterQuantity,

                    }
                    productCoveredArray.push(obj)


                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract?.dealerSku,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts,

                }
                productCoveredArray.push(obj)
            }

        }




        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');


        const coverageStartDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageStartDate).format("MM/DD/YYYY")}</p>
`).join('');

        const coverageEndDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageEndDate).format("MM/DD/YYYY")}</p>
`).join('');

        const term = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${product.term / 12} ${product.term / 12 === 1 ? 'Year' : 'Years'}</p>
`).join('');



        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: checkOrder.servicerId, isPrimary: true } } }, { isDeleted: false })
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
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;">GET COVER service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.metaData[0]?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of GET COVER service contract holder:</td>
                        <td style="font-size:13px;">${checkCustomer ? checkCustomer?.street : ''}, ${checkCustomer ? checkCustomer?.city : ''}, ${checkCustomer ? checkCustomer?.state : ''}, ${checkCustomer ? checkCustomer?.country : ''}</td>
                   </tr>
                 <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${coverageStartDates}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${term} 
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${coverageEndDates}</td >
          </tr >
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
            const termConditionFile = checkOrder.termCondition.fileName
            const termPath = termConditionFile
            //Download from S3 bucket 
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
            //send notification to admin and dealer 
            const adminActiveOrderQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "orderNotifications.addingNewOrderActive": true },
                            { status: true },
                            {
                                $or: [
                                    { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                                    { metaId: checkOrder.dealerId },
                                    { metaId: checkOrder.customerId },
                                    { metaId: checkOrder.resellerId },
                                ]
                            },

                        ]
                    }
                },
            }

            let adminUsers = await supportingFunction.getNotificationEligibleUser(adminActiveOrderQuery, { email: 1 })

            const base_url = `${process.env.SITE_URL}`

            let notificationEmails = adminUsers.map(user => user.email)
            let settingData = await userService.getSetting({});
            let emailData = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName: '',
                content: `Congratulations, your order # ${checkOrder.unique_key} has been created in our system. Please login to the system and view your order details. Also, we have attached our T&C to the email for the review. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                subject: "Process Order",
                redirectId: base_url + "orderDetails/" + checkOrder._id
            }

            let mailing = sgMail.send(emailConstant.sendTermAndCondition(notificationEmails, ["noreply@getcover.com"], emailData, attachment))



        })
        return 1

    }
    catch (err) {
        console.log(err.message)
        return {
            code: constant.errorCode,
            message: err.message
        }
    }
}

//Get File data from S3 bucket

const getObjectFromS3 = (bucketReadUrl) => {
    return new Promise((resolve, reject) => {
        S3Bucket.getObject(bucketReadUrl, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const wb = XLSX.read(data.Body);
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                let headers = [];

                for (let cell in sheet) {
                    if (
                        /^[A-Z]1$/.test(cell) &&
                        sheet[cell].v !== undefined &&
                        sheet[cell].v !== null &&
                        sheet[cell].v.trim() !== ""
                    ) {
                        headers.push(sheet[cell].v);
                    }
                }

                const result = {
                    headers: headers,
                    data: XLSX.utils.sheet_to_json(sheet, {
                        raw: false, // this ensures all cell values are parsed as text
                        dateNF: 'mm/dd/yyyy', // optional: specifies the date format if Excel stores dates as numbers
                        defval: '', // fills in empty cells with an empty string
                        cellDates: true, // ensures dates are parsed as JavaScript Date objects
                        cellText: false, // don't convert dates to text
                    }),
                };

                resolve(result);
            }
        });
    });
};

function isValidDate(dateString) {
    // Check the format with a regular expression
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;

    if (!regex.test(dateString)) {
        return false;
    }

    // Parse the date parts to integers
    const [month, day, year] = dateString.split("/").map(Number);

    // Check if the date is valid using the Date object
    const date = new Date(year, month - 1, day);

    // Check if the date parts match the parsed date
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}


// Create Order
exports.createOrder1 = async (req, res) => {
    try {
        let data = req.body;
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        data.resellerId = data.resellerId == 'null' ? null : data.resellerId;
        data.venderOrder = data.dealerPurchaseOrder;
        const orderTermCondition = data.termCondition != null ? data.termCondition : {}
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        let notificationData;
        let notificationArrayData = []
        let notificationEmails
        let emailData;
        let projection = { isDeleted: 0 };
        let settingData = await userService.getSetting({});
        let checkDealer = await dealerService.getDealerById(
            data.dealerId,
            projection
        );
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found",
            });
            return;
        }

        if (!checkDealer.status) {
            res.send({
                code: constant.errorCode,
                message: "Order can not be created, due to the dealer is inactive",
            });
            return;
        }

        if (data.servicerId) {
            let query = {
                $or: [
                    { _id: data.servicerId },
                    { resellerId: data.servicerId },
                    { dealerId: data.servicerId },
                ],
            };

            let checkServicer = await servicerService.getServiceProviderById(query);
            if (!checkServicer) {
                res.send({
                    code: constant.errorCode,
                    message: "Servicer not found",
                });
                return;
            }
        }

        if (data.customerId) {
            let query = { _id: data.customerId };
            let checkCustomer = await customerService.getCustomerById(query);
            if (!checkCustomer) {
                res.send({
                    code: constant.errorCode,
                    message: "Customer not found",
                });
                return;
            }
        }

        if (data.priceBookId) {
            let query = { _id: data.priceBookId };
            let checkPriceBook = await priceBookService.findByName1(query);
            if (!checkPriceBook) {
                res.send({
                    code: constant.errorCode,
                    message: "PriceBook not found",
                });
                return;
            }
        }

        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;

        let currentYear = new Date().getFullYear();
        let currentYearWithoutHypen = new Date().getFullYear();
        console.log(currentYear); // Outputs: 2024
        currentYear = "-" + currentYear + "-"

        let count = await orderService.getOrdersCount({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + currentYearWithoutHypen + data.unique_key_number
        data.unique_key = "GC" + currentYear + data.unique_key_number

        let checkVenderOrder = await orderService.getOrder(
            { venderOrder: data.dealerPurchaseOrder, dealerId: data.dealerId },
            {}
        );

        if (checkVenderOrder) {
            res.send({
                code: constant.errorCode,
                message: "dealer purchase order is already exist",
            });
            return;
        }

        data.status = "Pending";
        if (data.paymentStatus == "Paid") {
            data.paidAmount = data.orderAmount
            data.dueAmount = 0
        }

        if (data.billTo == "Dealer") {
            let getUser = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
            data.billDetail = {
                billTo: "Dealer",
                detail: {
                    name: checkDealer.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: checkDealer.street + ' , ' + checkDealer.city + ' , ' + checkDealer.country + ' , ' + checkDealer.zip

                }
            }
        }
        if (data.billTo == "Reseller") {
            let getReseller = await resellerService.getReseller({ _id: data.resellerId })
            let getUser = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { metaId: getReseller._id, isPrimary: true } } })
            data.billDetail = {
                billTo: "Reseller",
                detail: {
                    name: getReseller.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: getReseller.street + ' , ' + getReseller.city + ' , ' + getReseller.country + ' , ' + getReseller.zip

                }
            }
        }
        if (data.billTo == "Custom") {
            data.billDetail = {
                billTo: "Custom",
                detail: {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address

                }
            }
        }

        let serviceCoverage = '';
        if (req.body.serviceCoverageType == "Labour") {
            serviceCoverage = "Labor"
        }
        if (req.body.serviceCoverageType == "Parts & Labour") {
            serviceCoverage = "Parts & Labor"
        }

        data.serviceCoverageType = serviceCoverage != '' ? serviceCoverage : req.body.serviceCoverageType

        let getChoosedProducts = data.productsArray
        for (let A = 0; A < getChoosedProducts.length; A++) {
            if (getChoosedProducts[A].coverageStartDate != "") {



                let addOneDay = new Date(getChoosedProducts[A].coverageStartDate)
                let addOneDay1 = new Date(getChoosedProducts[A].coverageStartDate)
                let addOneDay2 = new Date(getChoosedProducts[A].coverageStartDate)
                addOneDay2.setMonth(addOneDay2.getMonth() + getChoosedProducts[A].term)
                addOneDay2.setDate(addOneDay2.getDate() - 1)
                let addOneDay3 = new Date(getChoosedProducts[A].coverageStartDate)
                addOneDay3.setMonth(addOneDay3.getMonth() + getChoosedProducts[A].term)
                addOneDay3.setDate(addOneDay3.getDate() - 1)

                data.productsArray[A].coverageStartDate1 = addOneDay
                data.productsArray[A].coverageEndDate1 = addOneDay2
                data.productsArray[A].coverageStartDate = addOneDay1.setDate(addOneDay1.getDate() + 1);
                data.productsArray[A].coverageEndDate = addOneDay3.setDate(addOneDay3.getDate() + 1);

                // need for sethours to 0 0 0 0

                // data.productsArray[A].coverageStartDate1 = new Date(data.productsArray[A].coverageStartDate1).setHours(0, 0, 0, 0)
                // data.productsArray[A].coverageStartDate = new Date(data.productsArray[A].coverageStartDate).setHours(0, 0, 0, 0)
                // data.productsArray[A].coverageEndDate1 = new Date(data.productsArray[A].coverageEndDate1).setHours(0, 0, 0, 0)
                // data.productsArray[A].coverageEndDate = new Date(data.productsArray[A].coverageEndDate).setHours(0, 0, 0, 0)


            }
            if (getChoosedProducts[A].coverageStartDate == "") {
                data.productsArray[A].coverageStartDate1 = null
                data.productsArray[A].coverageEndDate1 = null
                data.productsArray[A].coverageStartDate = null
                data.productsArray[A].coverageEndDate = null
            }
            if (getChoosedProducts[A].coverageStartDate == "") {
                data.productsArray[A].coverageStartDate1 = null
                data.productsArray[A].coverageEndDate1 = null
                data.productsArray[A].coverageStartDate = null
                data.productsArray[A].coverageEndDate = null
            }
            if (!getChoosedProducts[A].adhDays) {
                res.send({
                    code: constant.errorCode,
                    message: "Coverage type data for waiting days and deductible is not provided"
                })
                return;
            }
            if (getChoosedProducts[A].adhDays.length == 0) {
                let dealerPriceBookId = getChoosedProducts[A].priceBookId
                let getDealerPriceBookId = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, priceBook: dealerPriceBookId })
                data.productsArray[A].adhDays = getDealerPriceBookId.adhDays
            }
        }

        let savedResponse = await orderService.addOrder(data);
        var orderServiceCoverageType = savedResponse.serviceCoverageType

        if (!savedResponse) {
            let logData = {
                endpoint: "order/createOrder",
                body: data,
                userId: req.userId,
                response: {
                    code: constant.errorCode,
                    message: "unable to create order",
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "unable to create order",
            });
            return;
        }
        let returnField = [];

        var checkOrder = await orderService.getOrder(
            { _id: savedResponse._id },
        );

        let resultArray = checkOrder.productsArray.map(
            (item) => item.coverageStartDate === null
        );

        let isEmptyOrderFile = checkOrder.productsArray
            .map(
                (item) =>
                    item.orderFile.fileName === ""
            )

        // Update Term and condtion while create order
        let uploadTermAndCondtion = await orderService.updateOrder(
            { _id: checkOrder._id },
            { termCondition: orderTermCondition },
            { new: true }
        );

        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);

        //send notification to admin and dealer 
        let adminPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        {
                            $or: [
                                { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                            ]
                        },
                    ]
                }
            },
        }
        let dealerPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        { metaId: savedResponse.dealerId },

                    ]
                }
            },
        }
        let resellerPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        { metaId: savedResponse.resellerId }
                    ]
                }
            },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminPendingQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerPendingQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerPendingQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const ID1 = dealerUsers.map(user => user._id)
        const dealerEmails = dealerUsers.map(user => user.email)
        const ID2 = resellerUsers.map(user => user._id)
        const resellerEmails = resellerUsers.map(user => user.email)
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.dealerId, isPrimary: true } } })
        let adminNotificationData = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs
        };
        notificationArrayData.push(adminNotificationData)

        let dealerNotificationData = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: ID1
        };
        notificationArrayData.push(dealerNotificationData)

        let resellerNotificationData = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: ID2
        };
        notificationArrayData.push(resellerNotificationData)


        // Send Email code here
        notificationEmails = adminUsers.map(user => user.email)
       
        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: '',
            content: `A new Order # ${savedResponse.unique_key} has been created. The order is still in the pending state. To complete the order please click here and fill the data`,
            subject: "New Order",
            redirectId: base_url + "editOrder/" + savedResponse._id,
        }

        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let paidDate = {
                name: "processOrder",
                date: new Date()
            }
            let updatePaidDate = await orderService.updateOrder(
                { _id: checkOrder._id },
                { paidDate: paidDate },
                { new: true }
            );

            let count1 = await contractService.getContractsCountNew({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            var pricebookDetail = []
            let checkLength = savedResponse.productsArray.length - 1
            let checkOrderForService = await orderService.getOrder({ _id: savedResponse._id })

            for (let k = 0; k < savedResponse.productsArray.length; k++) {
                let product = savedResponse.productsArray[k]
                let index = k

                let headerLength;
                if (data.adh && isNaN(data.adh)) {

                    res.send({
                        code: contact.errorCode,
                        message: "Order is created successfully,but unable to create the contract due to the invalid ADH day"
                    })
                    return
                }

                let pricebookDetailObject = {}
                let dealerPriceBookObject = {}
                pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
                pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
                pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
                pricebookDetailObject._id = product?.priceBookDetails._id
                pricebookDetailObject.name = product?.priceBookDetails.name
                pricebookDetailObject.categoryId = product?.priceBookDetails.category
                pricebookDetailObject.term = product?.priceBookDetails.term
                pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
                pricebookDetailObject.price = product.price
                pricebookDetailObject.noOfProducts = product.checkNumberProducts

                pricebookDetailObject.retailPrice = product.unitPrice
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails[0].brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails[0]._id
                pricebookDetail.push(pricebookDetailObject)

                const readOpts = { // <--- need these settings in readFile options
                    cellDates: true
                };

                const jsonOpts = {
                    defval: '',
                    raw: false,
                    dateNF: '"m"/"d"/"yyyy"' // <--- need dateNF in sheet_to_json options (note the escape chars)
                }
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                const bucketReadUrl = { Bucket: process.env.bucket_name, Key: product.orderFile.fileName };
                // Await the getObjectFromS3 function to complete
                const result = await getObjectFromS3(bucketReadUrl);

                headerLength = result.headers
                if (headerLength.length !== 8) {
                    res.send({
                        code: constant.errorCode,
                        message: "Invalid file format detected. The sheet should contain exactly four columns."
                    })
                    return
                }
                let priceBookId = product.priceBookId;
                let coverageStartDate = product.coverageStartDate;
                let coverageStartDate1 = product.coverageStartDate1;
                let coverageEndDate = product.coverageEndDate;
                let coverageEndDate1 = product.coverageEndDate1;
                let orderProductId = product._id;

                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };

                let projection = { isDeleted: 0 };

                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: checkOrder.dealerId };
                let dealerPriceBook = await dealerPriceService.getDealerPriceById(
                    dealerQuery,
                    {}
                );

                const totalDataComing1 = result.data
                const totalDataComing = totalDataComing1.map((item) => {
                    const keys = Object.keys(item);
                    return {
                        brand: item[keys[0]],
                        model: item[keys[1]],
                        serial: item[keys[2]],
                        condition: item[keys[3]],
                        retailValue: item[keys[4]],
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                var contractArray = [];

                let dealerBookDetail = []

                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, priceBook: priceBookId })

                totalDataComing.forEach((data, index1) => {
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + currentYearWithoutHypen + unique_key_number1
                    let unique_key1 = "OC" + currentYear + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                    claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                    // -------------------------------------------------  copy from -----------------------------------------//

                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh != '' ? Number(product.adh) : 0 : 0)
                    let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                    let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                    dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + Number(adhDays)))
                    if (!isValidDate(data.purchaseDate)) {
                        res.send({
                            code: constant.successCode,
                            message: `All date should be in the format MM/DD/YYYY , order has been created please update the file in edit order to create the contracts `
                        })
                        return
                    };
                    let p_date = new Date(data.purchaseDate)
                    let p_date1 = new Date(data.purchaseDate)
                    let l_date = new Date(data.purchaseDate)
                    let l_date1 = new Date(data.purchaseDate)
                    let purchaseMonth = p_date.getMonth();
                    let monthsPart = partWarrantyMonth;
                    let newPartMonth = purchaseMonth + monthsPart;

                    let monthsLabour = labourWarrantyMonth;
                    let newLabourMonth = purchaseMonth + monthsLabour;

                    let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
                    let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
                    let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
                    let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
                    //---------------------------------------- till here ----------------------------------------------

                    // Find the minimum date
                    let minDate;

                    let adhDaysArray = product.adhDays
                    adhDaysArray.sort((a, b) => a.waitingDays - b.waitingDays);
                    const futureDate = new Date(product.coverageStartDate);
                    let minDate1 = futureDate.setDate(futureDate.getDate() + adhDaysArray[0].waitingDays);
                    if (!product.isManufacturerWarranty) {
                        if (adhDaysArray.length == 1) {
                            const hasBreakdown = adhDaysArray.some(item => item.value === 'breakdown');
                            if (hasBreakdown) {
                                let minDate2
                                if (orderServiceCoverageType == "Parts") {
                                    minDate2 = partsWarrantyDate1
                                } else if (orderServiceCoverageType == "Labour" || orderServiceCoverageType == "Labor") {
                                    minDate2 = labourWarrantyDate1
                                } else {
                                    if (partsWarrantyDate1 > labourWarrantyDate1) {
                                        minDate2 = labourWarrantyDate1
                                    } else {
                                        minDate2 = partsWarrantyDate1
                                    }
                                }
                                if (minDate1 > minDate2) {
                                    minDate = minDate1
                                }
                                if (minDate1 < minDate2) {
                                    minDate = minDate2
                                }
                            } else {
                                minDate = minDate1
                            }
                        }
                        else {
                            minDate = minDate1
                        }

                    } else {
                        minDate = minDate1

                    }
                    // let eligibilty = new Date(dateCheck) < new Date() ? true : false
                    minDate = new Date(minDate).setHours(0, 0, 0, 0)
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    //reporting codes 
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderUniqueKey: savedResponse.unique_key,
                        minDate: new Date(minDate),
                        venderOrder: savedResponse.venderOrder,
                        orderProductId: orderProductId,
                        coverageStartDate: coverageStartDate,
                        coverageStartDate1: coverageStartDate1,
                        dealerSku: dealerPriceBook.dealerSku,
                        coverageEndDate: coverageEndDate,
                        coverageEndDate1: coverageEndDate1,
                        productName: priceBook[0]?.name,
                        pName: priceBook[0]?.pName,
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: new Date(partsWarrantyDate1),
                        serviceCoverageType: serviceCoverage,
                        coverageType: req.body.coverageType,
                        labourWarranty: new Date(labourWarrantyDate1),
                        purchaseDate: new Date(data.purchaseDate),
                        serial: data.serial,
                        status: claimStatus,
                        eligibilty: eligibilty,
                        condition: data.condition,
                        adhDays: product.adhDays,
                        noOfClaimPerPeriod: product.noOfClaimPerPeriod,
                        noOfClaim: product.noOfClaim,
                        isManufacturerWarranty: product.isManufacturerWarranty,
                        isMaxClaimAmount: product.isMaxClaimAmount,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };

                    increamentNumber++

                    contractArray.push(contractObject);
                });

                let saveContracts = await contractService.createBulkContracts(contractArray);

                if (saveContracts.length == 0) {
                    let logData = {
                        endpoint: "order/createOrder",
                        body: data,
                        userId: req.userId,
                        response: {
                            code: constant.errorCode,
                            message: "Something went wrong in creating the contract",
                            saveContracts
                        }
                    }
                    await LOG(logData).save()
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Pending" },
                        { new: true }
                    );
                    res.send({
                        code: constant.errorCode,
                        message: "Something went wrong in creating the contract",
                    });
                    return
                }
                if (saveContracts[0]) {
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Active" },
                        { new: true }
                    );

                    //generate T anc C
                    if (checkOrder?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }

                    notificationArrayData = []
                    const adminActiveOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.addingNewOrderActive": true },
                                    { status: true },
                                    { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                                ]
                            }
                        },
                    }

                    const dealerActiveOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.addingNewOrderActive": true },
                                    { status: true },
                                    { metaId: checkOrder.dealerId },
                                ]
                            }
                        },
                    }

                    const resellerActiveOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.addingNewOrderActive": true },
                                    { status: true },
                                    { metaId: checkOrder.resellerId ? checkOrder.resellerId : "000008041eb1acda24111111" },
                                ]
                            }
                        },
                    }

                    const customerActiveOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.addingNewOrderActive": true },
                                    { status: true },
                                    {
                                        $or: [
                                            { metaId: checkOrder.customerId },
                                        ]
                                    },

                                ]
                            }
                        },
                    }
                    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminActiveOrderQuery, { email: 1 })
                    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerActiveOrderQuery, { email: 1 })
                    let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerActiveOrderQuery, { email: 1 })
                    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerActiveOrderQuery, { email: 1 })
                    let id = adminUsers.map(user => user._id)
                    let id1 = dealerUsers.map(user => user._id)
                    let id2 = resellerUsers.map(user => user._id)
                    let id3 = customerUsers.map(user => user._id)
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.dealerId, isPrimary: true } } })
                    let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.customerId, isPrimary: true } } })
                    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.resellerId, isPrimary: true } } })
                    let notificationData1 = {
                        title: "Order Added Successfully",
                        description: `A new Order # ${checkOrder.unique_key} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url + "orderDetails/" + savedResponse._id,
                        flag: 'order',
                        notificationFor: id
                    };
                    let notificationData2 = {
                        title: "Order Added Successfully",
                        description: `A new Order # ${checkOrder.unique_key} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url + "orderDetails/" + savedResponse._id,
                        flag: 'order',
                        notificationFor: id1
                    };
                    let notificationData3 = {
                        title: "Order Added Successfully",
                        description: `A new Order # ${checkOrder.unique_key} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url + "orderDetails/" + savedResponse._id,
                        flag: 'order',
                        notificationFor: id2
                    };
                    let notificationData4 = {
                        title: "Order Added Successfully",
                        description: `A new Order # ${checkOrder.unique_key} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url + "orderDetails/" + checkOrder._id,
                        flag: 'order',
                        notificationFor: id3
                    };

                    notificationArrayData.push(notificationData1)
                    notificationArrayData.push(notificationData2)
                    notificationArrayData.push(notificationData3)
                    notificationArrayData.push(notificationData4)

                    let createNotification = await userService.saveNotificationBulk(notificationArrayData);

                    // Send Email code here
                    if (!checkOrder?.termCondition || checkOrder?.termCondition == null || checkOrder?.termCondition == '') {
                        let notificationEmails = adminUsers.map(user => user.email)
                        let dealerEmails = dealerUsers.map(user => user.email)
                        let resellerEmails = resellerUsers.map(user => user.email)
                        let customerEmails = customerUsers.map(user => user.email)
                        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails, customerEmails)
                        //Email to Dealer
                        let emailData = {
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            websiteSetting: settingData[0],
                            senderName: '',
                            content: `Congratulations, your order # ${checkOrder.unique_key} has been created in our system. Please login to the system and view your order details. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                            subject: "Process Order",
                            redirectId: base_url + "orderDetails/" + checkOrder._id
                        }

                        let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ["noreply@getcover.com"], emailData))
                    }



                    let logData = {
                        endpoint: "order/createOrder",
                        body: data,
                        userId: req.userId,
                        response: {
                            code: constant.successCode,
                            message: "Success2",
                            saveContracts
                        }
                    }

                    await LOG(logData).save()
                    //reporting codes 
                    let getPriceBookDetail = await priceBookService.findByName1({ _id: priceBookId })
                    if (index == checkLength) {

                        let reportingData = {
                            orderId: savedResponse._id,
                            products: pricebookDetail,
                            orderAmount: data.orderAmount,
                            dealerId: data.dealerId,
                        }

                        await supportingFunction.reportingData(reportingData)
                    }
                }

            }
            res.send({
                code: constant.successCode,
                message: "Success1",
            });
            return

        } else {
            let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ["noreply@getcover.com"], emailData))
            let createNotification = await userService.saveNotificationBulk(notificationArrayData);

            let logData = {
                endpoint: "order/createOrder",
                body: data,
                userId: req.userId,
                response: {
                    code: constant.successCode,
                    message: "Success",
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Success3",
            });
        }
    } catch (err) {
        let logData = {
            endpoint: "order/createOrder catch",
            body: req.body,
            userId: req.userId,
            response: {
                code: constant.errorCode,
                message: err.message,
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message,
            errDetail: err.stack
        })
    }
};
// validating of edit file in order
exports.editFileCase = async (req, res) => {
    try {
        let data = req.body;
        let productsWithFiles = []
        if (data.productsArray.length > 0) {
            for (let i = 0; i < data.productsArray.length; i++) {
                if (Object.keys(data.productsArray[i]?.orderFile).length > 0 && data.productsArray[i]?.orderFile.fileName != '') {
                    let fileName = { Bucket: process.env.bucket_name, Key: data.productsArray[i]?.orderFile.fileName };
                    const readOpts = { // <--- need these settings in readFile options
                        //cellText:false, 
                        cellDates: true
                    };

                    var jsonOpts = {
                        //header: 1,
                        defval: '',
                        // blankrows: true,
                        raw: false,
                        dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
                    }
                    let product = {
                        key: i,
                        checkNumberProducts: data.productsArray[i].checkNumberProducts,
                        noOfProducts: data.productsArray[i].noOfProducts,
                        priceType: data.productsArray[i].priceType,
                        rangeStart: data.productsArray[i].rangeStart,
                        rangeEnd: data.productsArray[i].rangeEnd,
                        flag: data.productsArray[i].fileValue,
                        file: fileName
                    }

                    productsWithFiles.push(product)
                }
            }
            let allHeaders = [];
            let allDataComing = [];
            let message = [];
            let finalRetailValue = [];
            if (productsWithFiles.length > 0) {
                for (let j = 0; j < productsWithFiles.length; j++) {
                    if (productsWithFiles[j].file != undefined) {
                        const bucketReadUrl = productsWithFiles[j].file
                        // Await the getObjectFromS3 function to complete
                        const result = await getObjectFromS3(bucketReadUrl);

                        allDataComing.push({
                            key: productsWithFiles[j].key,
                            checkNumberProducts: productsWithFiles[j].checkNumberProducts,
                            noOfProducts: productsWithFiles[j].noOfProducts,
                            priceType: productsWithFiles[j].priceType,
                            rangeStart: productsWithFiles[j].rangeStart,
                            rangeEnd: productsWithFiles[j].rangeEnd,
                            data: result.data,
                        });

                        allHeaders.push({
                            key: productsWithFiles[j].key,
                            headers: result.headers,
                        });
                    }
                }

                const errorMessages = allHeaders
                    .filter((headerObj) => headerObj.headers.length !== 8)
                    .map((headerObj) => ({
                        key: headerObj.key,
                        message:
                            "Invalid file format detected. The sheet should contain exactly eight columns.",
                    }));
                if (errorMessages.length > 0) {
                    // There are errors, send the error messages
                    res.send({
                        code: constant.errorCode,
                        message: errorMessages,
                    });
                    return;
                }

                if (allDataComing.length > 0) {
                    const isValidLength1 = allDataComing.map((obj) => {
                        if (!obj.data || typeof obj.data !== "object") {
                            return false; // 'data' should be an object
                        }

                        const orderFileData = obj.data.map(item => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        orderFileData.forEach((fileData) => {
                            let brand = fileData.brand.toString().replace(/\s+/g, ' ').trim()
                            let serial = fileData.serial.toString().replace(/\s+/g, ' ').trim()
                            let condition = fileData.condition.toString().replace(/\s+/g, ' ').trim()
                            let retailValue = fileData.retailValue.toString().replace(/\s+/g, ' ').trim()
                            let model = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let partsWarranty = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let labourWarranty = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            let purchaseDate = fileData.model.toString().replace(/\s+/g, ' ').trim()
                            if (brand == '' || serial == '' || condition == '' || retailValue == '' || model == '' || partsWarranty == '' || labourWarranty == '' || purchaseDate == '') {
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid fields value",
                                });

                                return;
                            }
                        });
                    });
                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let serialNumber = allDataComing.map((obj) => {
                        const serialNumberArray = obj.data.map((item) => {
                            const keys = Object.keys(item);
                            let serials = item[keys[2]].toString().toLowerCase()
                            return {
                                key: obj.key,
                                serialNumber: serials
                            };
                        });

                        if (serialNumberArray.length > 0) {
                            const seen = new Set();
                            const duplicates = [];

                            for (const { key, serialNumber } of serialNumberArray) {
                                const keySerialPair = `${key}-${serialNumber}`;
                                if (seen.has(keySerialPair)) {
                                    message.push({
                                        code: 401,
                                        key: key,
                                        message: "Serial numbers are not unique for this product"
                                    });
                                    return
                                } else {
                                    seen.add(keySerialPair);

                                }
                            }
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                    //Check if csv data length equal to no of products
                    const isValidNumberData = allDataComing.map((obj) => {
                        if (obj.priceType == "Quantity Pricing") {
                            if (parseInt(obj.checkNumberProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                //return; // Set the return value to false when the condition fails
                            }
                        } else {
                            if (parseInt(obj.noOfProducts) != obj.data.length) {
                                // Handle case where 'noOfProducts' doesn't match the length of 'data'
                                message.push({
                                    code: constant.errorCode,
                                    key: obj.key,
                                    message: "Invalid number of products",
                                });
                                // return; // Set the return value to false when the condition fails
                            }
                        }
                    });

                    if (message.length > 0) {
                        // Handle case where the number of properties in 'data' is not valid
                        res.send({
                            message,
                        });
                        return;
                    }

                    let checkRetailValue = allDataComing.map((obj1) => {
                        const priceObj = obj1.data.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                key: obj1.key,
                                checkNumberProducts: obj1.checkNumberProducts,
                                noOfProducts: obj1.noOfProducts,
                                rangeStart: obj1.rangeStart,
                                rangeEnd: obj1.rangeEnd,
                                retailValue: item[keys[4]],
                                partsWarranty: item[keys[5]],
                                labourWarranty: item[keys[6]],
                                purchaseDate: item[keys[7]],
                            };
                        });
                        if (priceObj.length > 0) {
                            priceObj.map((obj, index) => {
                                //check Purchase date is valid or not
                                if (!isValidDate(obj.purchaseDate)) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: `Purchase date should be in the format MM/DD/YYYY `
                                    });
                                    return;
                                }
                                if (isNaN(obj.retailValue) || obj.retailValue < 0) {
                                    {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Retail Price should be integer and positive!!",
                                        });

                                        return;
                                    }
                                }
                                // check if the input value is a number
                                let p_warranty = Number(obj.partsWarranty)
                                let l_warranty = Number(obj.labourWarranty)
                                if (!isNaN(p_warranty) || !isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(p_warranty) || isNaN(l_warranty)) {
                                    // check if it is float
                                    // alter this condition to check the integer
                                    if (!Number.isInteger(p_warranty) || !Number.isInteger(l_warranty)) {
                                        message.push({
                                            code: constant.errorCode,
                                            key: obj.key,
                                            message: "Parts warranty and labour warranty should be an integer.",
                                        });

                                        return;
                                    }
                                }
                                if (isNaN(new Date(obj.purchaseDate).getTime())) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'Invalid Date!'
                                    });
                                    return;
                                }
                                if (new Date(obj.purchaseDate) > new Date()) {
                                    message.push({
                                        code: constant.errorCode,
                                        key: obj.key,
                                        message: 'The purchase date should be present date and past date!'
                                    });
                                    return;
                                }
                                if (obj1.priceType == 'Flat Pricing') {
                                    if (Number(obj.retailValue) < Number(obj.rangeStart) || Number(obj.retailValue) > Number(obj.rangeEnd)) {
                                        {
                                            message.push({
                                                code: constant.errorCode,
                                                key: obj.key,
                                                message: "Retail price should be between start and end range!",
                                            });

                                            return;
                                        }
                                    }
                                }


                            });
                        }
                    });

                    if (message.length > 0) {
                        res.send({
                            message,
                        });
                        return;
                    }
                }
            }
            res.send({
                code: constant.successCode,
                message: 'Success!',
                productDetail: req.body
            })
        }
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//get edit order Detail
exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        let logData = {
            endpoint: "order/editOrderDetail",
            body: data,
            userId: req.userId,
            response: {}
        };
        data.venderOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        let checkId = await orderService.getOrder({ _id: req.params.orderId });
        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid order ID",
            });
            return;
        }
        if (checkId.status == "Active" || checkId.status == "Archieved") {
            res.send({
                code: constant.errorCode,
                message: "Order is already active",
            });
            return;
        }
        if (data.dealerId != "") {
            if (data.dealerId.toString() != checkId.dealerId.toString()) {
                let checkDealer = await dealerService.getDealerById(
                    data.dealerId
                );
                if (!checkDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Dealer not found",
                    });
                    return;
                }
            }
        }

        if (data.servicerId != "") {
            if (data.servicerId != '' && data.servicerId != checkId.servicerId) {
                let query = {
                    $or: [
                        { _id: data.servicerId },
                        { resellerId: data.servicerId },
                        { dealerId: data.servicerId },
                    ],
                };
                let checkServicer = await servicerService.getServiceProviderById(query);
                if (!checkServicer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Servicer not found",
                    });
                    return;
                }
            }
        }
        if (data.customerId != "") {
            if (data.customerId != '' && data.customerId != checkId.customerId) {
                let query = { _id: data.customerId };
                let checkCustomer = await customerService.getCustomerById(query);
                if (!checkCustomer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Customer not found",
                    });
                    return;
                }
            }
        }

        if (checkId.status == 'Archieved') {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived!",
            });
            return;
        }
        if (data.billTo == "Dealer") {
            let checkDealer1 = await dealerService.getDealerById(
                data.dealerId
            );
            let getUser = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { metaId: checkDealer1._id, isPrimary: true } } })

            data.billDetail = {
                billTo: "Dealer",
                detail: {
                    name: checkDealer1.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: checkDealer1.street + ' , ' + checkDealer1.city + ' , ' + checkDealer1.country + ' , ' + checkDealer1.zip
                }
            }
        }
        if (data.billTo == "Reseller") {
            let getReseller = await resellerService.getReseller({ _id: data.resellerId })
            let getUser = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { metaId: getReseller._id, isPrimary: true } } })

            data.billDetail = {
                billTo: "Reseller",
                detail: {
                    name: getReseller.name,
                    email: getUser.email,
                    phoneNumber: getUser.phoneNumber,
                    address: getReseller.street + ' , ' + getReseller.city + ' , ' + getReseller.country + ' , ' + getReseller.zip
                }
            }
        }
        if (data.billTo == "Custom") {
            data.billDetail = {
                billTo: "Custom",
                detail: {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address
                }
            }
        }
        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
        data.customerId = data.customerId != "" ? data.customerId : null;
        let serviceCoverage = '';
        if (req.body.serviceCoverageType == "Labour") {
            serviceCoverage = "Labor"
        }
        if (req.body.serviceCoverageType == "Parts & Labour") {
            serviceCoverage = "Parts & Labor"
        }

        data.serviceCoverageType = serviceCoverage != '' ? serviceCoverage : req.body.serviceCoverageType

        if (data.paymentStatus == "Paid") {
            data.paidAmount = data.orderAmount
            data.dueAmount = 0
        }

        if (data.paidAmount == data.orderAmount) {
            data.paymentStatus = "Paid"
        }
        if (req.files) {
            const uploadedFiles = req.files.map((file) => ({
                fileName: file.filename,
                originalName: file.originalname,
                filePath: file.path,
            }));

            const filteredProducts = data.productsArray.filter(
                (product) => product.orderFile.fileName !== ""
            );
            const filteredProducts2 = data.productsArray.filter(
                (product) => product.file === ""
            );

            const productsWithOrderFiles = filteredProducts.map((product, index) => {
                const file = uploadedFiles[index];
                // Check if 'file' is not null
                if (file && file.filePath) {
                    return {
                        ...product,
                        file: file.filePath,
                        orderFile: {
                            fileName: file.fileName,
                            originalName: file.originalName,
                        },
                    };
                } else {
                    // If 'file' is null, return the original product without modifications
                    return product;
                }
            });

            const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
            data.productsArray = finalOutput;
        }

        let getChoosedProducts = data.productsArray
        for (let A = 0; A < getChoosedProducts.length; A++) {
            if (getChoosedProducts[A].coverageStartDate != "") {
                let addOneDay = new Date(getChoosedProducts[A].coverageStartDate)
                let addOneDay1 = new Date(getChoosedProducts[A].coverageStartDate)
                let addOneDay2 = new Date(getChoosedProducts[A].coverageStartDate)
                console.log("checking the date+++++++++++++++++++++++", addOneDay2)
                addOneDay2.setMonth(addOneDay2.getMonth() + getChoosedProducts[A].term)
                addOneDay2.setDate(addOneDay2.getDate() - 1)
                console.log("checking the date+++++++++++++++++++++++", addOneDay2)
                let addOneDay3 = new Date(getChoosedProducts[A].coverageStartDate)
                console.log("checking the date+++++++++++++++++++++++", addOneDay3)
                addOneDay3.setMonth(addOneDay3.getMonth() + getChoosedProducts[A].term)
                addOneDay3.setDate(addOneDay3.getDate() - 1)

                console.log("checking the date+++++++++++++++++++++++", addOneDay3)

                data.productsArray[A].coverageStartDate1 = addOneDay
                data.productsArray[A].coverageEndDate1 = addOneDay2
                data.productsArray[A].coverageStartDate = addOneDay1.setDate(addOneDay1.getDate() + 1);
                data.productsArray[A].coverageEndDate = addOneDay3.setDate(addOneDay3.getDate() + 1);

            }
            if (getChoosedProducts[A].coverageStartDate == "") {
                data.productsArray[A].coverageStartDate1 = null
                data.productsArray[A].coverageEndDate1 = null
                data.productsArray[A].coverageStartDate = null
                data.productsArray[A].coverageEndDate = null
            }
            if (!getChoosedProducts[A].adhDays) {
                res.send({
                    code: constant.errorCode,
                    message: "Coverage type data for waiting days and deductible is not provided"
                })
                return;
            }
            if (getChoosedProducts[A].adhDays.length == 0) {
                let dealerPriceBookId = getChoosedProducts[A].priceBookId
                let getDealerPriceBookId = await dealerPriceService.getDealerPriceById({ dealerId: data.dealerId, priceBook: dealerPriceBookId })
                data.productsArray[A].adhDays = getDealerPriceBookId.adhDays
            }
        }


        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            data,
            { new: true }
        );


        var orderServiceCoverageType = savedResponse.serviceCoverageType
        if (!savedResponse) {
            logData.response = {
                code: constant.errorCode,
                message: "unable to update order",
            };
            await LOG(logData).save();
            res.send({
                code: constant.errorCode,
                message: "unable to update order",
            });
            return;
        }

        // check to processed order 
        let returnField = [];

        let checkOrder = await orderService.getOrder(
            { _id: req.params.orderId },
            // { isDeleted: 0 }
        );
        if (!checkOrder) {
            res.send({
                code: constant.errorCode,
                message: "Order not found!",
            });
            return;
        }

        let resultArray = checkOrder.productsArray.map(
            (item) => item.coverageStartDate === null
        );
        let isEmptyOrderFile = checkOrder.productsArray
            .map(
                (item) =>
                    item.orderFile.fileName === ""
            )
        // .some(Boolean);
        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);
        //send notification to dealer,reseller,admin,customer
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        let adminUpdateOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.updateOrderPending": true },
                        { status: true },
                        { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                    ]
                }
            },
        }
        let dealerUpdateOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.updateOrderPending": true },
                        { status: true },
                        { metaId: checkOrder.dealerId }
                    ]
                }
            },
        }
        let resellerUpdateOrderQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.updateOrderPending": true },
                        { status: true },
                        { metaId: checkOrder.resellerId ? checkOrder.resellerId : "000008041eb1acda24111111" }
                    ]
                }
            },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdateOrderQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUpdateOrderQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerUpdateOrderQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const IDs1 = dealerUsers.map(user => user._id)
        const IDs2 = resellerUsers.map(user => user._id)
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
        let notificationData = {
            title: "Draft Order Updated Successfully",
            description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs
        };
        let notificationData1 = {
            title: "Draft Order Updated Successfully",
            description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs1
        };
        let notificationData2 = {
            title: "Draft Order Updated Successfully",
            description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs2
        };
        let notificationArrayData = []
        notificationArrayData.push(notificationData)
        notificationArrayData.push(notificationData1)
        notificationArrayData.push(notificationData2)

        // Send Email code here
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)

        let resellerEmails = resellerUsers.map(user => user.email)

        let settingData = await userService.getSetting({});
        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        //Email to Dealer
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: '',
            content: `Your order # ${checkOrder.unique_key} has been updated in our system. The order is still pending, as there is some data missing. Please update the data using the link here.`,
            subject: "Order Update",
            redirectId: base_url + "editOrder/" + checkOrder._id,
        }

        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {

            let savedResponse = await orderService.updateOrder(
                { _id: req.params.orderId },
                { status: "Active" },
                { new: true }
            );

            let checkDealer1 = await dealerService.getDealerById(
                savedResponse.dealerId
            );

            let paidDate = {
                name: "processOrder",
                date: new Date()
            }
            let updatePaidDate = await orderService.updateOrder(
                { _id: req.params.orderId },
                { paidDate: paidDate },
                { new: true }
            );
            var pricebookDetail = []
            let currentYear = new Date().getFullYear();
            let currentYearWithoutHypen = new Date().getFullYear();
            console.log(currentYear); // Outputs: 2024
            currentYear = "-" + currentYear + "-"
            let count1 = await contractService.getContractsCountNew({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let checkLength = savedResponse.productsArray.length - 1
            let checkOrderForService = await orderService.getOrder({ _id: savedResponse._id })

            let save = savedResponse.productsArray.map(async (product, index) => {
                let headerLength;
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                const readOpts = { // <--- need these settings in readFile options
                    cellDates: true
                };
                const jsonOpts = {
                    defval: '',
                    raw: false,
                    dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
                }
                const bucketReadUrl = { Bucket: process.env.bucket_name, Key: product.orderFile.fileName };
                // Await the getObjectFromS3 function to complete
                const result = await getObjectFromS3(bucketReadUrl);
                headerLength = result.headers
                if (headerLength.length !== 8) {
                    res.send({
                        code: constant.errorCode,
                        message: "Invalid file format detected. The sheet should contain exactly four columns."
                    })
                    return
                }
                let priceBookId = product.priceBookId;
                let orderProductId = product._id;
                let coverageStartDate = product.coverageStartDate;
                let coverageStartDate1 = product.coverageStartDate1;
                let coverageEndDate = product.coverageEndDate;
                let coverageEndDate1 = product.coverageEndDate1;
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                let projection = { isDeleted: 0 };

                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                //dealer Price Book
                let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: savedResponse.dealerId };

                let dealerPriceBook = await dealerPriceService.getDealerPriceById(
                    dealerQuery,
                    projection
                );
                // reporting codes
                let pricebookDetailObject = {}
                let dealerBookDetail = []
                let dealerPriceBookObject = {}

                pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
                pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
                pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
                pricebookDetailObject._id = product?.priceBookDetails._id
                pricebookDetailObject.name = product?.priceBookDetails.name
                pricebookDetailObject.categoryId = product?.priceBookDetails.category
                pricebookDetailObject.term = product?.priceBookDetails.term
                pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
                pricebookDetailObject.price = product.price
                pricebookDetailObject.noOfProducts = product.checkNumberProducts

                pricebookDetailObject.retailPrice = product.unitPrice
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails[0].brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails[0]._id
                pricebookDetail.push(pricebookDetailObject)
                dealerBookDetail.push(dealerPriceBookObject)
                const totalDataComing1 = result.data;
                const totalDataComing = totalDataComing1.map((item) => {
                    const keys = Object.keys(item);
                    return {
                        brand: item[keys[0]],
                        model: item[keys[1]],
                        serial: item[keys[2]],
                        condition: item[keys[3]],
                        retailValue: item[keys[4]],
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                var contractArray = [];

                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: priceBookId })
                totalDataComing.forEach((data, index) => {
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + currentYearWithoutHypen + unique_key_number1
                    let unique_key1 = "OC" + currentYear + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                    claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                    // -------------------------------------------------  copy from -----------------------------------------//

                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh != '' ? product.adh : 0 : 0)
                    let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
                    let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)

                    dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + adhDays))
                    let p_date = new Date(data.purchaseDate)
                    let p_date1 = new Date(data.purchaseDate)
                    let l_date = new Date(data.purchaseDate)
                    let l_date1 = new Date(data.purchaseDate)
                    let purchaseMonth = p_date.getMonth();
                    let monthsPart = partWarrantyMonth;
                    let newPartMonth = purchaseMonth + monthsPart;

                    let monthsLabour = labourWarrantyMonth;
                    let newLabourMonth = purchaseMonth + monthsLabour;

                    let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
                    let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
                    let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
                    let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
                    //---------------------------------------- till here ----------------------------------------------

                    // Find the minimum date
                    let minDate;

                    let adhDaysArray = product.adhDays

                    adhDaysArray.sort((a, b) => a.waitingDays - b.waitingDays);

                    const futureDate = new Date(product.coverageStartDate)

                    let minDate1 = futureDate.setDate(futureDate.getDate() + adhDaysArray[0].waitingDays);
                    if (!product.isManufacturerWarranty) {
                        if (adhDaysArray.length == 1) {
                            const hasBreakdown = adhDaysArray.some(item => item.value === 'breakdown');
                            if (hasBreakdown) {
                                let minDate2
                                if (orderServiceCoverageType == "Parts") {
                                    minDate2 = partsWarrantyDate1
                                } else if (orderServiceCoverageType == "Labour" || orderServiceCoverageType == "Labor") {
                                    minDate2 = labourWarrantyDate1
                                } else {
                                    if (partsWarrantyDate1 > labourWarrantyDate1) {
                                        minDate2 = labourWarrantyDate1
                                    } else {
                                        minDate2 = partsWarrantyDate1
                                    }
                                }
                                if (minDate1 > minDate2) {
                                    minDate = minDate1
                                }
                                if (minDate1 < minDate2) {
                                    minDate = minDate2
                                }
                            } else {
                                minDate = minDate1
                            }
                        }
                        else {
                            minDate = minDate1
                        }

                    } else {
                        minDate = minDate1
                    }
                    minDate = new Date(minDate).setHours(0, 0, 0, 0)
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    let serviceCoverage;
                    if (orderServiceCoverageType == "Labour") {
                        serviceCoverage = "Labor"
                    }
                    if (orderServiceCoverageType == "Parts & Labour") {
                        serviceCoverage = "Parts & Labor"
                    }

                    let contractObject = {
                        orderId: savedResponse._id,
                        orderUniqueKey: savedResponse.unique_key,
                        venderOrder: savedResponse.venderOrder,
                        orderProductId: orderProductId,
                        minDate: new Date(minDate),
                        coverageStartDate: coverageStartDate,
                        coverageStartDate1: coverageStartDate1,
                        coverageEndDate1: coverageEndDate1,
                        coverageEndDate: coverageEndDate,
                        dealerSku: dealerPriceBook.dealerSku,
                        serviceCoverageType: serviceCoverage,
                        coverageType: checkOrder.coverageType,
                        productName: priceBook[0]?.name,
                        pName: priceBook[0]?.pName,
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: new Date(partsWarrantyDate1),
                        labourWarranty: new Date(labourWarrantyDate1),
                        purchaseDate: new Date(data.purchaseDate),
                        status: claimStatus,
                        eligibilty: eligibilty,
                        adhDays: product.adhDays,
                        noOfClaimPerPeriod: product.noOfClaimPerPeriod,
                        noOfClaim: product.noOfClaim,
                        isManufacturerWarranty: product.isManufacturerWarranty,
                        isMaxClaimAmount: product.isMaxClaimAmount,
                        serial: data.serial,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };
                    increamentNumber++;
                    contractArray.push(contractObject);
                });
                let saveData = await contractService.createBulkContracts(contractArray)
                if (saveData.length == 0) {
                    logData.response = {
                        code: constant.errorCode,
                        message: "unable to make contracts",
                        result: saveData
                    };
                    await LOG(logData).save();
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Pending" },
                        { new: true }
                    );
                } else {
                    let savedResponse = await orderService.updateOrder(
                        { _id: checkOrder._id },
                        { status: "Active" },
                        { new: true }
                    );

                    // 
                    //Send email to customer with term and condtion
                    //generate T anc C
                    if (checkOrder?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }
                    // send notification to dealer,admin, customer
                    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
                    const base_url = `${process.env.SITE_URL}`
                    let adminUpdateOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.updateOrderActive": true },
                                    { status: true },
                                    { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                                ]
                            }
                        },
                    }
                    let dealerUpdateOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.updateOrderActive": true },
                                    { status: true },
                                    { metaId: checkOrder.dealerId },
                                ]
                            }
                        },
                    }
                    let resellerUpdateOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.updateOrderActive": true },
                                    { status: true },
                                    { metaId: checkOrder.resellerId ? checkOrder.resellerId : "000008041eb1acda24111111" },
                                ]
                            }
                        },
                    }
                    let customerUpdateOrderQuery = {
                        metaData: {
                            $elemMatch: {
                                $and: [
                                    { "orderNotifications.updateOrderActive": true },
                                    { status: true },
                                    { metaId: checkOrder.customerId },
                                ]
                            }
                        },
                    }

                    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdateOrderQuery, { email: 1 })
                    let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerUpdateOrderQuery, { email: 1 })
                    let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerUpdateOrderQuery, { email: 1 })
                    let customerUsers = await supportingFunction.getNotificationEligibleUser(customerUpdateOrderQuery, { email: 1 })
                    const IDs = adminUsers.map(user => user._id)
                    const IDs1 = dealerUsers.map(user => user._id)
                    const IDs2 = resellerUsers.map(user => user._id)
                    const IDs3 = customerUsers.map(user => user._id)
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
                    let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.customerId, isPrimary: true } } })
                    let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.resellerId, isPrimary: true } } })
                    let notificationData = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url,
                        notificationFor: IDs
                    };
                    let notificationData1 = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url,
                        notificationFor: IDs1
                    };
                    let notificationData2 = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url,
                        notificationFor: IDs2
                    };
                    let notificationData3 = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "orderDetails/" + checkOrder._id,
                        endPoint: base_url,
                        notificationFor: IDs3
                    };
                    notificationArrayData = []
                    notificationArrayData.push(notificationData)
                    notificationArrayData.push(notificationData1)
                    notificationArrayData.push(notificationData2)
                    notificationArrayData.push(notificationData3)
                    let createNotification = await userService.saveNotificationBulk(notificationArrayData);
                    // Send Email code here
                    if (!checkOrder?.termCondition) {
                        let notificationEmails = adminUsers.map(user => user.email)
                        let dealerEmails = dealerUsers.map(user => user.email)
                        let resellerEmails = resellerUsers.map(user => user.email)
                        let customermails = customerUsers.map(user => user.email)
                        let mergedEmail = notificationEmails.concat(dealerEmails,resellerEmails,customermails)
                        //Email to Dealer
                        let emailData = {
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            websiteSetting: settingData[0],
                            senderName: '',
                            content: "The order " + savedResponse.unique_key + " updated and processed",
                            subject: "Process Order",
                            redirectId: base_url + "orderDetails/" + checkOrder._id,
                        }

                        let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ["noreply@getcover.com"], emailData))
                    }

                    //Email to customer code here........
                    if (index == checkLength) {

                        let reportingData = {
                            orderId: savedResponse._id,
                            products: pricebookDetail,
                            orderAmount: data.orderAmount,
                            dealerId: data.dealerId,
                            // dealerPriceBook: dealerBookDetail
                        }

                        await supportingFunction.reportingData(reportingData)
                    }

                }


            })

            // reporting codes
            logData.response = {
                code: constant.successCode,
                message: "Success",
            };
            await LOG(logData).save();
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        } else {
            if (data.sendNotification) {
                let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ["noreply@getcover.com"], emailData))
            }
            let createNotification = await userService.saveNotificationBulk(notificationArrayData);


            logData.response = {
                code: constant.successCode,
                message: "Success",
            };
            await LOG(logData).save();
            res.send({
                code: constant.successCode,
                message: "Success",
            });
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

//Get Order Contract
exports.getOrderContract = async (req, res) => {
    try {
        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        // let getTheThresholdLimir = await userService.getUserById1({ roleId: process.env.super_admin, isPrimary: true })
        let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let dealerIds = [];
        let customerIds = [];
        let resellerIds = [];
        let servicerIds = [];
        let userSearchCheck = 0
        if (data.customerName != "") {
            userSearchCheck = 1
            let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                customerIds = await getData.map(customer => customer._id)
            } else {
                customerIds.push("1111121ccf9d400000000000")
            }
        };
        if (data.servicerName != "") {
            userSearchCheck = 1
            let getData = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                servicerIds = await getData.map(servicer => servicer._id)
            } else {
                servicerIds.push("1111121ccf9d400000000000")
            }
        };
        if (data.resellerName != "") {
            userSearchCheck = 1
            let getData = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                resellerIds = await getData.map(servicer => servicer._id)
            } else {
                resellerIds.push("1111121ccf9d400000000000")
            }
        };
        if (data.dealerName != "") {
            userSearchCheck = 1
            let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                dealerIds = await getData.map(dealer => dealer._id)
            } else {
                dealerIds.push("1111121ccf9d400000000000")
            }
        };
        let orderAndCondition = []
        if (req.params.orderId) {
            userSearchCheck = 1
            orderAndCondition.push({ _id: new mongoose.Types.ObjectId(req.params.orderId) })
        };

        if (dealerIds.length > 0) {
            orderAndCondition.push({ dealerId: { $in: dealerIds } })
        }
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })
        }
        let orderIds = []
        if (orderAndCondition.length > 0) {
            let getOrders = await orderService.getOrders({
                $and: orderAndCondition
            })
            if (getOrders.length > 0) {
                orderIds = await getOrders.map(order => order._id)
            }
        }
        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { eligibilty: data.eligibilty === "true" ? true : false },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        } else {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        }

        if (userSearchCheck == 1) {
            contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
        }
        let mainQuery = []
        if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
            mainQuery = [
                { $sort: { unique_key_number: -1 } },

                {
                    $facet: {
                        totalRecords: [
                            {
                                $count: "total"
                            }
                        ],
                        data: [
                            {
                                $skip: skipLimit
                            },
                            {
                                $limit: pageLimit
                            },
                            {
                                $project: {
                                    productName: 1,
                                    model: 1,
                                    serial: 1,
                                    unique_key: 1,
                                    dealerSku: 1,
                                    status: 1,
                                    minDate: 1,
                                    productValue: 1,
                                    manufacture: 1,
                                    eligibilty: 1,
                                    orderUniqueKey: 1,
                                    venderOrder: 1,
                                    totalRecords: 1
                                }
                            }
                        ],
                    },

                },
            ]
        } else {
            mainQuery = [
                { $sort: { unique_key_number: -1 } },

                {
                    $match:
                    {
                        $and: contractFilterWithEligibilty
                    },
                },

            ]
            mainQuery.push({
                $facet: {
                    totalRecords: [
                        {
                            $count: "total"
                        }
                    ],
                    data: [
                        {
                            $skip: skipLimit
                        },
                        {
                            $limit: pageLimit
                        },
                        {
                            $project: {
                                productName: 1,
                                model: 1,
                                serial: 1,
                                dealerSku: 1,
                                unique_key: 1,
                                status: 1,
                                minDate: 1,
                                manufacture: 1,
                                serviceCoverageType: 1,
                                productValue: 1,
                                coverageType: 1,
                                eligibilty: 1,
                                orderUniqueKey: 1,
                                venderOrder: 1,
                                totalRecords: 1
                            }
                        }
                    ],
                },

            })
        }
        let getContracts = await contractService.getAllContracts2(mainQuery)
        checkOrder = getContracts[0]?.data ? getContracts[0]?.data : []
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

        let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
        for (let e = 0; e < result1.length; e++) {
            result1[e].reason = " "
            if (!result1[e].eligibilty) {
                result1[e].reason = "Claims limit cross for this contract"
            }
            if (result1[e].status != "Active") {
                result1[e].reason = "Contract is not active"
            }
            if (new Date(result1[e].minDate) > new Date()) {

                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                };
                const formattedDate = new Date(result1[e].minDate).toLocaleDateString('en-US', options)
                result1[e].reason = "Contract will be eligible on " + " " + formattedDate
            }
            let claimQuery = [
                {
                    $match: { contractId: new mongoose.Types.ObjectId(result1[e]._id) }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
                        openFileClaimsCount: { // Count of claims where claimfile is "Open"
                            $sum: {
                                $cond: {
                                    if: { $eq: ["$claimFile", "open"] }, // Assuming "claimFile" field is correct
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    }
                }
            ]

            let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
            if (checkClaims[0]) {
                if (checkClaims[0].openFileClaimsCount > 0) {
                    result1[e].reason = "Contract has open claim"

                }
                if (checkClaims[0].totalAmount >= result1[e].productValue) {
                    result1[e].reason = "Claim value exceed the product value limit"
                }
            }


            let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
            const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
            let overThreshold = result1[e].claimAmount > thresholdLimitValue;
            let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
            if (!overThreshold) {
                threshHoldMessage = ""
            }
            if (!thresholdLimitPercentage.isThreshHoldLimit) {
                overThreshold = false
                threshHoldMessage = ""
            }
            result1[e].threshHoldMessage = threshHoldMessage
            result1[e].overThreshold = overThreshold
        }
        if (!checkOrder[0]) {
            res.send({
                code: constant.successCode,
                message: "Success!",
                result: result1,
                totalCount: 0,
                orderUserData: {}
            })
            return
        }

        res.send({
            code: constant.successCode,
            message: "Success!",
            result: getContracts[0]?.data ? getContracts[0]?.data : [],
            totalCount: totalCount,
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

