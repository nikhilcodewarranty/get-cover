const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
const dealerService = require("../../Dealer/services/dealerService");
const servicerService = require("../../Provider/services/providerService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");
const mongoose = require('mongoose');
exports.createOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let data = req.body
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
        data.customerId = data.customerId ? data.customerId :  new mongoose.Types.ObjectId('61c8c7d38e67bb7c7f7eeeee')
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
        res.send({
            code: constant.successCode,
            message: "Success",
            result: savedResponse
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
        const servicerName = item1.servicerId!='' ? respectiveServicer.find(item2 => item2._id.toString() === item1.servicerId.toString()) : null;
        const customerName = item1.customerId!='' ? respectiveCustomer.find(item2 => item2._id.toString() === item1.customerId.toString()):null;
        if (dealerName || customerName || servicerName) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                dealerName: dealerName ? dealerName.toObject() : dealerName,
                servicerName: servicerName ? servicerName.toObject(): {},
                customerName: customerName ? customerName.toObject():{},
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