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
}).array('orderFile', 100)

var uploadP = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).single('file')



exports.createOrder = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            // let data = req.body 
            let data = {
                "dealerId": "65a0d25d503003dcd4abfc33",
                "servicerId": "65a0d64b23eec30f66ea0c44",
                "customerId": "65a0e563169e80fd0600a965",
                "productsArray": [
                    {
                        "categoryId": "65a0dacd3a9009fd982ba41e",
                        "priceBookId": "65a0daf83a9009fd982ba41f",
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

            if (req.role != "Super Admin") {
                res.send({
                    code: constant.errorCode,
                    message: "Only super admin allow to do this action"
                })
                return;
            }
            console.log("data+++++++++++++++++++++++", req.files, data)
            let productArray = data.productsArray;
            data.venderOrder = data.dealerPurchaseOrder
            let finalContractArray = [];
            if (data.dealerId) {
                let projection = { isDeleted: 0 }
                let checkDealer = await dealerService.getDealerById(data.dealerId, projection);
                if (!checkDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Dealer not found"
                    })
                    return;
                }
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
            if (data.categoryId) {
                let query = { _id: data.categoryId }
                let checkCategory = await priceBookService.getPriceCatById(query, { isDeleted: 0 })
                if (!checkCategory) {
                    res.send({
                        code: constant.errorCode,
                        message: "Category not found"
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
            console.log(productArray);
            data.orderAmount = productArray.reduce((accumulator, object) => {
                return accumulator + object.price;
            }, 0);
            data.createdBy = req.userId
            data.servicerId = data.servicerId ? data.servicerId : new mongoose.Types.ObjectId('61c8c7d38e67bb7c7f7eeeee')
            data.customerId = data.customerId ? data.customerId : new mongoose.Types.ObjectId('61c8c7d38e67bb7c7f7eeeee')
            let count = await orderService.getOrdersCount()
            data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
            let savedResponse = await orderService.addOrder(data);
            if (!savedResponse) {
                res.send({
                    code: constant.errorCode,
                    message: "unable to create order"
                });
                return;
            }
            let count1 = await contractService.getContractsCount();
            let contractCount = Number(count1.length > 0 && count1[0].unique_key ? count1[0].unique_key : 0) + 1;
            //Read csv file from product array one by one
            const uploadedFiles = req.files.map(file => ({
                fileName: file.filename,
                filePath: file.path
            }));


            const productsWithFiles = uploadedFiles.map((file, index) => ({
                products: {
                    ...data.productsArray[index],
                    file: file.filePath,
                },
            }));

              console.log('check+++++++++++++++++++++++++',productsWithFiles);
            for (let i = 0; i < productsWithFiles.length; i++) {
                let products = productsWithFiles[i].products

                let priceBookId = products.priceBookId
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) }
                let projection = { isDeleted: 0 }
                let priceBook = await priceBookService.getPriceBookById(query, projection)
                const wb = XLSX.readFile(products.file);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
                const totalDataComing1 = XLSX.utils.sheet_to_json(ws);
              console.log('check+++++++++++++++++++111111111++++++',ws,products.file);
              finalContractArray = totalDataComing1.map(item => {
                    const keys = Object.keys(item);
                    return {
                        orderId: savedResponse._id,
                        productName: priceBook[0].name,
                        manufacture: item[keys[1]],
                        model: item[keys[2]],
                        serial: item[keys[3]],
                        condition: item[keys[4]],
                        productValue: item[keys[5]],
                        // regDate: item[keys[6]],
                        unique_key: contractCount

                    };
                });
                contractCount = contractCount + 1;
            }
            console.log("finalContractArray++++++++++++++++++", finalContractArray);
            
            //Create Bulk Contracts


            let bulkContracts = await contractService.createBulkContracts(finalContractArray)
            if (!bulkContracts) {
                res.send({
                    code: constant.errorCode,
                    message: 'Error while create contracts!'
                })
                return;
            }
            res.send({
                code: constant.successCode,
                message: "Success",
                result: savedResponse
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
    console.log("ordersResult+++++++++++++++++", ordersResult);
    console.log("respectiveDealers+++++++++++++++++", respectiveDealers);
    const result_Array = ordersResult.map(item1 => {
        const dealerName = respectiveDealers.find(item2 => item2._id.toString() === item1.dealerId.toString());
        console.log("dealerName+++++++++++++++++", dealerName);
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
    res.send({
        code: constant.successCode,
        result: result_Array
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
                    message: "Invalid file format detected. The sheet should contain exactly six columns."
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
            if (data.noOfProducts != totalDataComing1.length) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.errorCode,
                    message: "Data does not match to the number of orders"
                })
                return;
            }
            //    await  fs.unlink(`../../uploads/orderFile/${req.file.filename}`)
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