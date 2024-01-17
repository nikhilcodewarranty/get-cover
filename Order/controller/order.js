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
        cb(null, path.join(__dirname, '../../uploads/orderFile'));
    },
    filename: function (req, files, cb) {
        cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
    }
})

var uploadP = multer({
    storage: StorageP,
}).single('file');



exports.createOrder = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            if (req.role != "Super Admin") {
                res.send({
                    code: constant.errorCode,
                    message: "Only super admin allow to do this action"
                })
                return;
            }
            let data = req.body
            let productArray = req.productsArray;
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
            //Read csv file from product array one by one
            for (let i = 0; i < productArray.length; i++) {
                let file = productArray[i].file
                const wb = XLSX.readFile(file.path);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
                const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
                finalContractArray = totalDataComing1.map(item => {
                    const keys = Object.keys(item);
                    return {
                        orderId: savedResponse._id,
                        productName: 'AAA',
                        manufacture: item[keys[1]],
                        model: item[keys[2]],
                        serial: item[keys[3]],
                        condition: item[keys[5]],
                        productValue: item[keys[8]],
                        regDate: item[keys[9]],

                    };
                });
            }
            let bulkContracts = await contractService.createBulkContracts(finalContractArray)
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

            if (headers.length !== 6) {
                // fs.unlink('../../uploads/orderFile/' + req.file.filename)
                res.send({
                    code: constant.errorCode,
                    message: "Invalid file format detected. The sheet should contain exactly six columns."
                })
                return
            }

            const isValidLength = totalDataComing1.every(obj => Object.keys(obj).length === 6);
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