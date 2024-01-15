const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
const dealerService = require("../../Dealer/services/dealerService");
const servicerService = require("../../Provider/services/providerService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");

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
         let savedResponse =  await orderService.addOrder(data);
         if(!savedResponse){
            res.send({
                code:constant.errorCode,
                message:"unable to create order"
            });
            return;
         }
        res.send({
            code: constant.successCode,
            message: "Success",
            result:savedResponse
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};