const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
const dealerService = require("../../Dealer/services/dealerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const resellerService = require("../../Dealer/services/resellerService");
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
const moment = require('moment');
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const userService = require("../../User/services/userService");

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
            let data = req.body
            // let data = {
            //     "dealerId": "65aba175107144beb95f3bcf",
            //     "servicerId": "",
            //     "customerId": "",
            //     "resellerId": "",
            //     "productsArray": [
            //         {
            //             "categoryId": "65aba24e182e38ce2ea76f6a",
            //             "priceBookId": "65aba2ad182e38ce2ea76f6b",
            //             "unitPrice": "80.00",
            //             "noOfProducts": "",
            //             "price": 160,
            //             "file": "",
            //             "manufacture": "Get-Cover123",
            //             "model": "Inverter123",
            //             "serial": "S123GHK",
            //             "condition": "Breakdown",
            //             "productValue": 123,
            //             "regDate": "2024-01-18T00:00:00.000Z",
            //             "coverageStartDate": "2024-01-30T00:00:00.000Z",
            //             "coverageEndDate": "2025-01-30T00:00:00.000Z",
            //             "description": "003",
            //             "term": 12,
            //             "priceType": "Quantity Pricing",
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
            //             "categoryId": "65aba24e182e38ce2ea76f6a",
            //             "priceBookId": "65aba2ad182e38ce2ea76f6b",
            //             "unitPrice": "80.00",
            //             "noOfProducts": "",
            //             "price": 160,
            //             "file": null,
            //             "manufacture": "Get-Cover123",
            //             "model": "222222222Inverter123",
            //             "serial": "S123GHK",
            //             "condition": "Breakdown",
            //             "productValue": 123,
            //             "regDate": "2024-01-18T00:00:00.000Z",
            //             "coverageStartDate": "2024-01-30T00:00:00.000Z",
            //             "coverageEndDate": "2025-01-30T00:00:00.000Z",
            //             "description": "003",
            //             "term": 12,
            //             "priceType": "Regular",
            //             "additionalNotes": "this is test ",
            //             "noOfProducts": 1
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
                let query = {
                    $or: [
                        { _id: data.servicerId },
                        { resellerId: data.servicerId },
                        { dealerId: data.servicerId },
                    ]
                }
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
            data.resellerId = data.resellerId != '' ? data.resellerId : null
            data.customerId = data.customerId != '' ? data.customerId : null
            let contractArrrayData = []

            let count = await orderService.getOrdersCount()

            data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
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
            let checkVenderOrder = await orderService.getOrder({ venderOrder: data.dealerPurchaseOrder, dealerId: data.dealerId }, {})
            if (checkVenderOrder) {
                res.send({
                    code: constant.errorCode,
                    message: "dealer purchase order is already exist"
                })
                return;
            }
            let savedResponse = await orderService.addOrder(data);
            if (!savedResponse) {
                res.send({
                    code: constant.errorCode,
                    message: "unable to create order"
                });
                return;
            }
            let fileLength = req.files ? req.files.length : 0
            if (fileLength === data.productsArray.length && data.customerId != '' && data.paymentStatus == "Paid") {

                const isValidDate = data.productsArray.every(product => {
                    console.log(product.coverageStartDate)
                    const coverageStartDate = product.coverageStartDate != '' ? moment(product.coverageStartDate).format('YYYY-MM-DD') : product.coverageStartDate;
                    return moment(coverageStartDate, 'YYYY-MM-DD', true).isValid();
                });
                if (isValidDate) {
                    console.log('valid date +++++++++++++++++++++++++++++++++++++++')
                    let contractArrrayData = []
                    for (let i = 0; i < data.productsArray.length; i++) {
                        let products = data.productsArray[i]

                        let priceBookId = products.priceBookId
                        let query = { _id: new mongoose.Types.ObjectId(priceBookId) }
                        let projection = { isDeleted: 0 }
                        let priceBook = await priceBookService.getPriceBookById(query, projection)

                        const wb = XLSX.readFile(products.file);
                        const sheets = wb.SheetNames;
                        const ws = wb.Sheets[sheets[0]];

                        let count1 = await contractService.getContractsCount();
                        let contractCount = Number(count1.length > 0 && count1[0].unique_key ? count1[0].unique_key : 0) + 1;

                        const totalDataComing1 = XLSX.utils.sheet_to_json(ws);

                        const totalDataComing = totalDataComing1.map(item => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                            };
                        });
                        let contractObject = {
                            orderId: savedResponse._id,
                            productName: priceBook[0].name,
                            manufacture: totalDataComing[0]['brand'],
                            model: totalDataComing[0]['model'],
                            serial: totalDataComing[0]['serial'],
                            condition: totalDataComing[0]['condition'],
                            productValue: totalDataComing[0]['retailValue'],
                            unique_key: contractCount

                        }
                        contractArrrayData.push(contractObject)
                    }
                    let bulkContracts = await contractService.createBulkContracts(contractArrrayData)

                }
            }
            res.send({
                code: constant.successCode,
                message: "Success"
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
    const servicerCreteria = {
        $or: [
            { _id: { $in: servicerIdArray } },
            { resellerId: { $in: servicerIdArray } },
            { dealerId: { $in: servicerIdArray } },
        ]
    };
    //Get Respective Servicer
    let respectiveServicer = await servicerService.getAllServiceProvider(servicerCreteria, { name: 1 })
    let customerIdsArray = ordersResult.map(result => result.customerId)
    const customerCreteria = { _id: { $in: customerIdsArray } }
    //Get Respective Customer
    let respectiveCustomer = await customerService.getAllCustomers(customerCreteria, { username: 1 })
    //Get all Reseller
    let resellerIdsArray = ordersResult.map(result => result.resellerId)
    const resellerCreteria = { _id: { $in: resellerIdsArray } }
    let respectiveReseller = await resellerService.getResellers(resellerCreteria, { name: 1 })
    const result_Array = ordersResult.map(item1 => {
        const dealerName = item1.respectiveDealers != '' ? respectiveDealers.find(item2 => item2._id.toString() === item1.dealerId.toString()) : null;
        const servicerName = item1.servicerId != null ? respectiveServicer.find(item2 => item2._id.toString() === item1.servicerId.toString()) : null;
        const customerName = item1.customerId != null ? respectiveCustomer.find(item2 => item2._id.toString() === item1.customerId.toString()) : null;
        const resellerName = item1.resellerId != null ? respectiveReseller.find(item2 => item2._id.toString() === item1.resellerId.toString()) : null;
        if (dealerName || customerName || servicerName || resellerName) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                dealerName: dealerName ? dealerName.toObject() : dealerName,
                servicerName: servicerName ? servicerName.toObject() : {},
                customerName: customerName ? customerName.toObject() : {},
                resellerName: resellerName ? resellerName.toObject() : {},
            };
        } else {
            return {
                dealerName: dealerName.toObject(),
                servicerName: servicerName.toObject(),
                customerName: customerName.toObject(),
                resellerName: resellerName.toObject
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
            // if(!data.rangeStart||!data.rangeEnd){
            //     res.send({
            //         code:constant.errorCode,
            //         message:"Range start and range end is required"
            //     })
            //     return;
            // }
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
            console.log("totalDataComing========================", totalDataComing)
            const isValidRetailPrice = totalDataComing.map(obj => {
                // Check if 'noOfProducts' matches the length of 'data'
                console.log(obj)
                if (obj.retailValue < Number(data.rangeStart) || obj.retailValue > Number(data.rangeEnd)) {
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
            console.log("body data==================", data)
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

            if (req.files.length > 0) {
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
                        message: errorMessages
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
                        message
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
                        message
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

                        if (priceObj.length > 0) {
                            priceObj.map((obj, index) => {
                                if ((Number(obj.retailValue) < Number(obj.rangeStart) || Number(obj.retailValue) > Number(obj.rangeEnd))) {
                                    message.push({
                                        code: constant.errorCode,
                                        retailPrice: obj.retailValue,
                                        key: obj.key,
                                        message: "Invalid Retail Price!"
                                    });
                                }
                            })
                        }

                    }
                })

                if (message.length > 0) {
                    // Handle case where the number of properties in 'data' is not valid
                    res.send({
                        message
                    });
                    return;
                }
            }
            res.send({
                code: constant.successCode,
                message: "Success!"
            })

        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body
        let query;
        if (data.resellerId != '') {
            query = { dealerId: data.dealerId, resellerId: data.resellerId }
        } else {
            query = { dealerId: data.dealerId }

        }
        let getCustomers = await customerService.getAllCustomers(query, {})
        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers"
            })
            return;
        }

        res.send({
            code: constant.successCode,
            message: 'Successfully Fetched',
            result: getCustomers
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicerInOrders = async (req, res) => {
    let data = req.body;
    let servicer = []
    if (data.dealerId) {
        var checkDealer = await dealerService.getDealerById(data.dealerId, { isDeleted: 0 });
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: 'Dealer not found!'
            });
            return
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: data.dealerId })
        // if (!getServicersIds) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Unable to fetch the servicer"
        //     })
        //     return;
        // }
        let ids = getServicersIds.map((item) => item.servicerId)
        servicer = await servicerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }


    }
    if (data.resellerId) {
        var checkReseller = await resellerService.getReseller({ _id: data.resellerId })
        // if (!checkReseller) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Invalid Reseller ID"
        //     })
        //     return;
        // }


    }
    if (checkReseller && checkReseller.isServicer) {
        servicer.unshift(checkReseller)
    }

    if (checkDealer && checkDealer.isServicer) {
        servicer.unshift(checkDealer);
    }
    console.log('3rd-------------------------------', servicer)

    const servicerIds = servicer.map(obj => obj._id);
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getMembers(query1, {})
    if (!servicerUser) {
        res.send({
            code: constant.errorCode,
            message: "Unable to fetch the data"
        });
        return;
    };
    console.log('3rd-------------------------------', servicerUser)

    const result_Array = servicer.map(item1 => {
        const matchingItem = servicerUser.find(item2 => item2.accountId.toString() === item1._id.toString());

        if (matchingItem) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem.toObject()
            };
        } else {
            return servicer.toObject();
        }
    });

    res.send({
        code: constant.successCode,
        result: result_Array
    })

}

exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body

        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({ dealerId: req.params.dealerId, status: true })
        if (!getDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            })
            return;
        }
        // price book ids array from dealer price book
        let dealerPriceIds = getDealerPriceBook.map(item => item.priceBook)
        let query = { _id: { $in: dealerPriceIds } }
        console.log('getDealerPriceBook', getDealerPriceBook)
        // if(data.priceCatId){
        //     let categories = 
        //     query = { _id: { $in: dealerPriceIds } ,}
        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {})
        console.log("get price book", getPriceBooks)


        const dealerPriceBookMap = new Map(
            getDealerPriceBook.map((item) => [item.priceBook.toString(), item.retailPrice])
        );

        // Update getPriceBook array with retailPrice from getDealerPriceBook
        let mergedPriceBooks = getPriceBooks.map((item) => {
            const retailPrice = dealerPriceBookMap.get(item._id.toString()) || 0;
            return {
                ...item._doc,
                retailPrice,
            };
        });

        console.log("mergedPriceBook", mergedPriceBooks);







        //unique categories IDs from price books
        let uniqueCategory = {};
        let uniqueCategories = getPriceBooks.filter((item) => {
            if (!uniqueCategory[item.category.toString()]) {
                uniqueCategory[item.category.toString()] = true;
                return true;
            }
            return false;
        });

        uniqueCategories = uniqueCategories.map(item => item.category)

        // get categories related to dealers
        let getCategories = await priceBookService.getAllPriceCat({ _id: { $in: uniqueCategories } }, {})

        // gettign selected category if user select the price book first
        let filteredPiceBook;
        let checkSelectedCategory;
        let dealerPriceBookDetail = {
            "_id": "",
            "priceBook": "",
            "dealerId": "",
            "status": "",
            "retailPrice": "",
            "description": "",
            "isDeleted": "",
            "brokerFee": "",
            "unique_key": "",
            "wholesalePrice": "",
            "__v": 0,
            "createdAt": "",
            "updatedAt": ""
        }
        if (data.priceBookId || data.priceBookId != '') {
            filteredPiceBook = getPriceBooks
                .filter((item) => item._id.toString() === data.priceBookId)
                .map((item) => item.category);
            checkSelectedCategory = await priceBookService.getPriceCatByName({ _id: filteredPiceBook })

            dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: req.params.dealerId, priceBook: data.priceBookId })
        }

        if (data.priceCatId || data.priceCatId != '') {
            mergedPriceBooks = mergedPriceBooks
                .filter((item) => item.category.toString() === data.priceCatId)
            checkSelectedCategory = await priceBookService.getPriceCatByName({ _id: filteredPiceBook })

            // dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: req.params.dealerId, priceBook: data.priceBookId })
        }

        let result = {
            priceCategories: getCategories,
            priceBooks: mergedPriceBooks,
            selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
            dealerPriceBookDetail: dealerPriceBookDetail
        }


        console.log("uniqueCategories", uniqueCategories);
        console.log("checkSelectedCategory", checkSelectedCategory);
        console.log('dealer price ids', dealerPriceIds, "getPriceBooks", getPriceBooks)

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

exports.checkPurchaseOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let checkPurchaseOrder = await orderService.getOrder({ venderOrder: req.body.dealerPurchaseOrder }, { isDeleted: 0 });
        if (checkPurchaseOrder) {
            res.send({
                code: constant.errorCode,
                message: 'The order of this vendor number is already exist!'
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: 'Success!'
        })

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}
