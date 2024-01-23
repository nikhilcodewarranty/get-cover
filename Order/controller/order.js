const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
const dealerService = require("../../Dealer/services/dealerService");
const servicerService = require("../../Provider/services/providerService");
const contractService = require("../../Contract/services/contractService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");
const mongoose = require('mongoose'); const multer = require('multer');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require("xlsx");
const fs = require('fs')

var StorageP = multer.diskStorage({
    destination: function (req, files, cb) {
        console.log('file+++++++++++++++++++++', files)
        cb(null, path.join(__dirname, '../../uploads/orderFile'));
    },
    filename: function (req, files, cb) {
        cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
    }
})

var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array('file', 100)

var uploadP = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).single('file')


exports.createOrder = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            // let data = req.body
            let data = {
                "dealerId": "65aba175107144beb95f3bcf",
                "servicerId": "",
                "customerId": "",
                "productsArray": [
                    {
                        "categoryId": "65aba24e182e38ce2ea76f6a",
                        "priceBookId": "65aba2ad182e38ce2ea76f6b",
                        "unitPrice": "80.00",
                        "noOfProducts": "",
                        "price": 160,
                        "file": "",
                        "manufacture": "Get-Cover123",
                        "model": "Inverter123",
                        "serial": "S123GHK",
                        "condition": "Breakdown",
                        "productValue": 123,
                        "regDate": "2024-01-18T00:00:00.000Z",
                        "coverageStartDate": "2024-01-30T00:00:00.000Z",
                        "coverageEndDate": "2025-01-30T00:00:00.000Z",
                        "description": "003",
                        "term": 12,
                        "priceType": "Quantity Pricing",
                        "additionalNotes": "this is test ",
                        "QuantityPricing": [
                            {
                                "name": "a",
                                "quantity": 45,
                                "_id": "65a7863cc6690cd3e0a62256",
                                "enterQuantity": "20"
                            },
                            {
                                "name": "b",
                                "quantity": 10,
                                "_id": "65a7863cc6690cd3e0a62257",
                                "enterQuantity": "11"
                            }
                        ]
                    },
                    {
                        "categoryId": "65aba24e182e38ce2ea76f6a",
                        "priceBookId": "65aba2ad182e38ce2ea76f6b",
                        "unitPrice": "80.00",
                        "noOfProducts": "",
                        "price": 160,
                        "file": null,
                        "manufacture": "Get-Cover123",
                        "model": "222222222Inverter123",
                        "serial": "S123GHK",
                        "condition": "Breakdown",
                        "productValue": 123,
                        "regDate": "2024-01-18T00:00:00.000Z",
                        "coverageStartDate": "2024-01-30T00:00:00.000Z",
                        "coverageEndDate": "2025-01-30T00:00:00.000Z",
                        "description": "003",
                        "term": 12,
                        "priceType": "Regular",
                        "additionalNotes": "this is test ",
                        "noOfProducts": 1
                    }
                ],
                "sendNotification": true,
                "paymentStatus": "Paid",
                "dealerPurchaseOrder": "#12345",
                "serviceCoverageType": "Parts",
                "coverageType": "Breakdown",
                "orderAmount": 144,
                "paidAmount": 123,
                "dueAmount": 21
            }

            //check for super admin
            if (req.role != "Super Admin") {
                res.send({
                    code: constant.errorCode,
                    message: "Only super admin allow to do this action"
                })
                return;
            }
            data.venderOrder = data.dealerPurchaseOrder
            let projection = { isDeleted: 0 }
            let checkDealer = await dealerService.getDealerById(data.dealerId, projection);
            if (!checkDealer) {
                res.send({
                    code: constant.errorCode,
                    message: "Dealer not found"
                })
                return;
            }

            if (data.servicerId) {
                let query = { _id: data.servicerId }
                let checkServicer = await servicerService.getServiceProviderById(query)
                if (!checkServicer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Servicer not found"
                    })
                    return;
                }
            }
            if (data.customerId) {
                let query = { _id: data.customerId }
                let checkCustomer = await customerService.getCustomerById(query);
                if (!checkCustomer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Customer not found"
                    })
                    return;
                }
            }
            if (data.priceBookId) {
                let query = { _id: data.priceBookId }
                let checkPriceBook = await priceBookService.findByName1(query)
                if (!checkPriceBook) {
                    res.send({
                        code: constant.errorCode,
                        message: "PriceBook not found"
                    })
                    return;
                }
            }

            data.createdBy = req.userId
            data.servicerId = data.servicerId != '' ? data.servicerId : null
            data.customerId = data.customerId != '' ? data.customerId : null
            let contractArrrayData = []

            let count = await orderService.getOrdersCount()

            data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1



            // let count1 = await contractService.getContractsCount();
            // let contractCount = Number(count1.length > 0 && count1[0].unique_key ? count1[0].unique_key : 0) + 1;

            if (req.files) {
                const uploadedFiles = req.files.map(file => ({
                    fileName: file.filename,
                    originalName: file.originalname,
                    filePath: file.path
                }));

                const filteredProducts = data.productsArray.filter(product => product.file !== null);
                const filteredProducts2 = data.productsArray.filter(product => product.file === null);

                const productsWithOrderFiles = filteredProducts.map((product, index) => {
                    const file = uploadedFiles[index];

                    // Check if 'file' is not null
                    if (file && file.filePath) {
                        return {
                            ...product,
                            file: file.filePath,
                            orderFile: {
                                fileName: file.fileName,
                                originalName: file.originalName
                            }
                        };
                    } else {
                        // If 'file' is null, return the original product without modifications
                        return product;
                    }
                });

                const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
                data.productsArray = finalOutput


            }
            console.log('----------------------------------------------', data)

            let savedResponse = await orderService.addOrder(data);
            if (!savedResponse) {
                res.send({
                    code: constant.errorCode,
                    message: "unable to create order"
                });
                return;
            }

            console.log('----------------------------------------------', data)
            console.log('----------------------------------------------', data.servicerId, data.customerId, data.paymentStatus)

            // if (req.files.length === data.productsArray.length && data.customerId != '' && data.paymentStatus == "Paid") {
            //     console.log('contract save codes--------------------')
            // }
            res.send({
                code:constant.successCode,
                message:"Success"
            })
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getAllOrders = async (req, res) => {
    let data = req.body
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action"
        })
        return;
    }


    let ordersResult = await orderService.getAllOrders();
    let dealerIdsArray = ordersResult.map(result => result.dealerId)
    const dealerCreateria = { _id: { $in: dealerIdsArray } };
    //Get Respective Dealers
    let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, { name: 1 })
    let servicerIdArray = ordersResult.map(result => result.servicerId)
    const servicerCreteria = { _id: { $in: servicerIdArray } };
    //Get Respective Servicer
    let respectiveServicer = await servicerService.getAllServiceProvider(servicerCreteria, { name: 1 })
    let customerIdsArray = ordersResult.map(result => result.customerId)
    const customerCreteria = { _id: { $in: customerIdsArray } }
    //Get Respective Customer
    let respectiveCustomer = await customerService.getAllCustomers(customerCreteria, { username: 1 })

    const result_Array = ordersResult.map(item1 => {
        const dealerName = respectiveDealers.find(item2 => item2._id.toString() === item1.dealerId.toString());
        const servicerName = item1.servicerId != '' ? respectiveServicer.find(item2 => item2._id.toString() === item1.servicerId.toString()) : null;
        const customerName = item1.customerId != '' ? respectiveCustomer.find(item2 => item2._id.toString() === item1.customerId.toString()) : null;
        if (dealerName || customerName || servicerName) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                dealerName: dealerName ? dealerName.toObject() : dealerName,
                servicerName: servicerName ? servicerName.toObject() : {},
                customerName: customerName ? customerName.toObject() : {},
            };
        } else {
            return {
                dealerName: dealerName.toObject(),
                servicerName: servicerName.toObject(),
                customerName: customerName.toObject(),
            }
        }
    });

    const unique_keyRegex = new RegExp(data.unique_key ? data.unique_key.trim() : '', 'i')
    const venderOrderRegex = new RegExp(data.venderOrder ? data.venderOrder.trim() : '', 'i')
    const status = new RegExp(data.phone ? data.phone.trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
        return (
            unique_keyRegex.test(entry.unique_key) &&
            venderOrderRegex.test(entry.venderOrder) &&
            status.test(entry.status)
        );
    });


    res.send({
        code: constant.successCode,
        result: filteredData
    })
}

exports.checkFileValidation = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            let data = req.body
            let file = req.file

            let csvName = req.file.filename
            const csvWriter = createCsvWriter({
                path: './uploads/resultFile/' + csvName,
                header: [
                    { id: 'Brand', title: 'Brand' },
                    { id: 'Model', title: 'Model' },
                    { id: 'Serial', title: 'Serial' },
                    { id: 'Class', title: 'Class' },
                    { id: 'Condition', title: 'Condition' },
                    { id: 'Retail Value', title: 'Retail Value' },
                    // Add more headers as needed
                ],
            });
            const wb = XLSX.readFile(req.file.path);
            const sheets = wb.SheetNames;
            const ws = wb.Sheets[sheets[0]];
            let message = []
            const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
            // console.log(totalDataComing1); return;
            const headers = [];
            for (let cell in ws) {
                // Check if the cell is in the first row and has a non-empty value
                if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
                    headers.push(ws[cell].v);
                }
            }

            if (headers.length !== 5) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.errorCode,
                    message: "Invalid file format detected. The sheet should contain exactly five columns."
                })
                return
            }

            const isValidLength = totalDataComing1.every(obj => Object.keys(obj).length === 5);
            if (!isValidLength) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.errorCode,
                    message: "Invalid fields value"
                })
                return;
            }
            if (parseInt(data.noOfProducts) != totalDataComing1.length) {
                res.send({
                    code: constant.errorCode,
                    message: "Data does not match to the number of orders"
                })
                return;
            }
            //    await  fs.unlink(`../../uploads/orderFile/${req.file.filename}`)
            const totalDataComing = totalDataComing1.map(item => {
                const keys = Object.keys(item);
                return {
                    retailValue: item[keys[4]],
                };
            });

            // Check retail price is in between rangeStart and rangeEnd

            const isValidRetailPrice = totalDataComing.map(obj => {
                // Check if 'noOfProducts' matches the length of 'data'
                if (obj.retailValue < data.rangeStart || obj.retailValue > data.rangeEnd) {
                    message.push({
                        code: constant.errorCode,
                        retailPrice: obj.retailValue,
                        message: "Invalid Retail Price!"
                    });
                }
            });
            if (message.length > 0) {
                res.send({
                    data: message
                })
                return
            }
            res.send({
                code: constant.successCode,
                message: "Verified"
            })
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.checkMultipleFileValidation = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body
            // let data = {
            //     "dealerId": "65a0d25d503003dcd4abfc33",
            //     "servicerId": "65a0d64b23eec30f66ea0c44",
            //     "customerId": "65a0e563169e80fd0600a965",
            //     "productsArray": [
            //         {
            //             "categoryId": "65a0dacd3a9009fd982ba41e",
            //             "priceBookId": "65a0daf83a9009fd982ba41f",
            //             "unitPrice": "80.00",
            //             "noOfProducts": 1,
            //             "price": 160,
            //             "file": "",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123",
            //             "serial": "S123GHK",
            //             "condition": "Breakdown",
            //             "productValue": 123,
            //             rangeStart: 23425,
            //             rangeEnd: 23425,
            //             "regDate": "2024-01-18T00:00:00.000Z",
            //             "coverageStartDate": "2024-01-30T00:00:00.000Z",
            //             "coverageEndDate": "2025-01-30T00:00:00.000Z",
            //             "description": "003",
            //             "term": 12,
            //             "priceType": "Flat Pricing",
            //             "additionalNotes": "this is test ",
            //             "QuantityPricing": [
            //                 {
            //                     "name": "a",
            //                     "quantity": 45,
            //                     "_id": "65a7863cc6690cd3e0a62256",
            //                     "enterQuantity": "20"
            //                 },
            //                 {
            //                     "name": "b",
            //                     "quantity": 10,
            //                     "_id": "65a7863cc6690cd3e0a62257",
            //                     "enterQuantity": "11"
            //                 }
            //             ]
            //         },
            //         {
            //             "categoryId": "65a0dacd3a9009fd982ba41e",
            //             "priceBookId": "65a0daf83a9009fd982ba41f",
            //             "unitPrice": "80.00",
            //             "noOfProducts": 1,
            //             "price": 160,
            //             "file": "",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123",
            //             "serial": "S123GHK",
            //             "condition": "Breakdown",
            //             "productValue": 123,
            //             rangeStart: 23425,
            //             rangeEnd: 23423,
            //             "regDate": "2024-01-18T00:00:00.000Z",
            //             "coverageStartDate": "2024-01-30T00:00:00.000Z",
            //             "coverageEndDate": "2025-01-30T00:00:00.000Z",
            //             "description": "003",
            //             "term": 12,
            //             "priceType": "Flat Pricing",
            //             "additionalNotes": "this is test ",
            //             "QuantityPricing": [
            //                 {
            //                     "name": "a",
            //                     "quantity": 45,
            //                     "_id": "65a7863cc6690cd3e0a62256",
            //                     "enterQuantity": "20"
            //                 },
            //                 {
            //                     "name": "b",
            //                     "quantity": 10,
            //                     "_id": "65a7863cc6690cd3e0a62257",
            //                     "enterQuantity": "11"
            //                 }
            //             ]
            //         }
            //     ],
            //     "sendNotification": true,
            //     "paymentStatus": "Paid",
            //     "dealerPurchaseOrder": "#12345",
            //     "serviceCoverageType": "Parts",
            //     "coverageType": "Breakdown",
            //     "orderAmount": 144,
            //     "paidAmount": 123,
            //     "dueAmount": 21
            // }
            const uploadedFiles = req.files.map(file => ({
                filePath: file.path
            }));
            const productsWithFiles = uploadedFiles.map((file, index) => ({
                products: {
                    key: index + 1,
                    noOfProducts: data.productsArray[index].noOfProducts,
                    priceType: data.productsArray[index].priceType,
                    rangeStart: data.productsArray[index].rangeStart,
                    rangeEnd: data.productsArray[index].rangeEnd,
                    file: file.filePath,
                },
            }));

            let allHeaders = [];
            let allDataComing = [];
            let message = [];
            let finalRetailValue = [];
            //Collect all header length for all csv 
            for (let j = 0; j < productsWithFiles.length; j++) {
                const wb = XLSX.readFile(productsWithFiles[j].products.file);
                const sheets = wb.SheetNames;
                const sheet = wb.Sheets[sheets[0]];
                const headers = [];
                for (let cell in sheet) {
                    // Check if the cell is in the first row and has a non-empty value
                    if (/^[A-Z]1$/.test(cell) && sheet[cell].v !== undefined && sheet[cell].v !== null && sheet[cell].v.trim() !== '') {
                        headers.push(sheet[cell].v);
                    }
                }
                allDataComing.push({
                    key: productsWithFiles[j].products.key,
                    noOfProducts: productsWithFiles[j].products.noOfProducts,
                    priceType: productsWithFiles[j].products.priceType,
                    rangeStart: productsWithFiles[j].products.rangeStart,
                    rangeEnd: productsWithFiles[j].products.rangeEnd,
                    data: XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]])
                });
                allHeaders.push({
                    key: productsWithFiles[j].products.key,
                    headers: headers,
                });
            }
            //Check each csv if it does not contain 5 column

            console.log("allDataComing", allDataComing);
            console.log("product", productsWithFiles);
            const errorMessages = allHeaders
                .filter(headerObj => headerObj.headers.length !== 5)
                .map(headerObj => ({
                    key: headerObj.key,
                    message: "Invalid file format detected. The sheet should contain exactly five columns."
                }));
            if (errorMessages.length > 0) {
                // There are errors, send the error messages
                res.send({
                    code: constant.errorCode,
                    messages: errorMessages
                });
                return;
            }
            //Check if csv every column has data 
            const isValidLength1 = allDataComing.map(obj => {
                if (!obj.data || typeof obj.data !== 'object') {
                    return false; // 'data' should be an object
                }

                const isValidLength = obj.data.every(obj1 => Object.keys(obj1).length === 5);
                if (!isValidLength) {
                    message.push({
                        code: constant.errorCode,
                        key: obj.key,
                        message: "Invalid fields value"
                    })
                }

            });

            if (message.length > 0) {
                // Handle case where the number of properties in 'data' is not valid
                res.send({
                    data: message
                });
                return;
            }

            //Check if csv data length equal to no of products
            const isValidNumberData = allDataComing.map(obj => {

                if (parseInt(obj.noOfProducts) != obj.data.length) {
                    // Handle case where 'noOfProducts' doesn't match the length of 'data'
                    message.push({
                        code: constant.errorCode,
                        key: obj.key,
                        message: "Invalid number of products"
                    });
                    return; // Set the return value to false when the condition fails
                }
                
            });


            if (message.length > 0) {
                // Handle case where the number of properties in 'data' is not valid
                res.send({
                    data: message
                });
                return;
            }
            let checkRetailValue = allDataComing.map(obj => {
                if (obj.priceType == 'Flat Pricing') {
                    const priceObj = obj.data.map(item => {
                        const keys = Object.keys(item);
                        return {
                            key: obj.key,
                            noOfProducts: obj.noOfProducts,
                            rangeStart: obj.rangeStart,
                            rangeEnd: obj.rangeEnd,
                            retailValue: item[keys[4]],
                        };
                    });
                    finalRetailValue.push(priceObj)
                }
            })

            //console.log(finalRetailValue);return
            if (finalRetailValue.length > 0) {
                const fdfd = finalRetailValue.map(obj => {


                    if ((obj[0].retailValue < obj[0].rangeStart || obj[0].retailValue > obj[0].rangeEnd)) {
                        message.push({
                            code: constant.errorCode,
                            retailPrice: obj[0].retailValue,
                            key: obj[0].key,
                            message: "Invalid Retail Price!"
                        });
                    }
                });
            }
            if (message.length > 0) {
                // Handle case where the number of properties in 'data' is not valid
                res.send({
                    data: message
                });
                return;
            }


            res.send({
                code: constant.successCode,
                message: "Verified"
            })
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}


