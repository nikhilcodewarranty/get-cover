require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const orderService = require("../../Order/services/orderService")
const servicerService = require("../../Provider/services/providerService")
const contractService = require("../../Contract/services/contractService")
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

//users api

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

//price api

exports.createDealerPriceBook = async (req, res) => {
    try {
        let data = req.body
        const count = await dealerPriceService.getDealerPriceCount();
        data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
        console.log('check dealer+++++++++++++++', req.userId)
        let checkDealer = await dealerService.getDealerById(req.userId)
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        }
        if (checkDealer.status == "Pending") {
            res.send({
                code: constant.errorCode,
                message: "Account not approved yet"
            })
            return;
        }
        let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: data.priceBook }, {})
        if (!checkPriceBookMain) {
            res.send({
                code: constant.errorCode,
                message: "Invalid price book ID"
            })
            return;
        }
        let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: req.userId }, {})
        if (checkPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Dealer price book already created with this product name"
            })
            return;
        }
        let createDealerPrice = await dealerPriceService.createDealerPrice(data)
        if (!createDealerPrice) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the dealer price book"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
                result: createDealerPrice
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getDealerPriceBookById = async (req, res) => {
    try {
        if (req.role != "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer allow to do this action"
            })
            return;
        }
        let projection = { isDeleted: 0, __v: 0 }
        let query = { isDeleted: false, _id: new mongoose.Types.ObjectId(req.params.dealerPriceBookId) }
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

exports.getPriceBooks = async (req, res) => {
    try {
        let checkDealer = await dealerService.getSingleDealerById({ _id: req.userId }, { isDeleted: false })

        if (checkDealer.length == 0) {
            res.send({
                code: constant.errorCode,
                message: "Dealer Not found"
            })
            return;
        }
        let projection = { isDeleted: 0, __v: 0 }
        let query = { isDeleted: false, status: true, dealerId: new mongoose.Types.ObjectId(req.userId) }
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
exports.getResellerCustomers = async (req, res) => {
    try {
        if (req.role !== "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer is allowed to perform this action"
            });
            return
        }
        let data = req.body;
        let query = { isDeleted: false, resellerId: req.params.resellerId }
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id.toString());
        const orderCustomerIds = customers.map(obj => obj._id);
        const queryUser = { accountId: { $in: customersId }, isPrimary: true };


        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

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
                { customerId: { $in: orderCustomerIds }, status: "Active" },
                {
                    'venderOrder': { '$regex': req.body.venderOrderNumber ? req.body.venderOrderNumber : '', '$options': 'i' },
                },
            ]
        }
        let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$customerId');

        let result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const order = ordersResult.find(order => order._id.toString() === item1.accountId)
            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem.toObject(),
                    orderData: order ? order : {}
                };
            } else {
                return {};
            }
        });

        const emailRegex = new RegExp(data.email ? data.email : '', 'i')
        const nameRegex = new RegExp(data.firstName ? data.firstName : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
        console.log(result_Array);
        result_Array = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.customerData.username) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.customerData.dealerId) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            result: result_Array
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.customerOrders = async (req, res) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only Dealer allow to do this action!'
            });
            return;
        }
        let data = req.body
        let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, {})
        if (!checkCustomer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid customer ID"
            })
            return;
        }

        let ordersResult = await orderService.getAllOrders({ customerId: new mongoose.Types.ObjectId(req.params.customerId), status: { $ne: "Archieved" } }, { isDeleted: 0 })

        //Get Respective dealer
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        //Get Respective Dealers
        let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
            name: 1,
            isServicer: 1,
        });
        //Get Order Customer
        let customerIdsArray = ordersResult.map((result) => result.customerId);
        const customerCreteria = { _id: { $in: customerIdsArray } };
        let respectiveCustomer = await customerService.getAllCustomers(
            customerCreteria,
            { username: 1 }
        );
        //Get Respective Reseller

        let resellerIdsArray = ordersResult.map((result) => result.resellerId);
        const resellerCreteria = { _id: { $in: resellerIdsArray } };
        let respectiveReseller = await resellerService.getResellers(
            resellerCreteria,
            { name: 1, isServicer: 1 }
        );

        let servicerIdArray = ordersResult.map((result) => result.servicerId);
        const servicerCreteria = {
            $or: [
                { _id: { $in: servicerIdArray } },
                { resellerId: { $in: servicerIdArray } },
                { dealerId: { $in: servicerIdArray } },
            ],
        };
        //Get Respective Servicer
        let respectiveServicer = await servicerService.getAllServiceProvider(
            servicerCreteria,
            { name: 1 }
        );
        const result_Array = ordersResult.map((item1) => {
            const dealerName =
                item1.dealerId != ""
                    ? respectiveDealers.find(
                        (item2) => item2._id.toString() === item1.dealerId.toString()
                    )
                    : null;
            const servicerName =
                item1.servicerId != null
                    ? respectiveServicer.find(
                        (item2) =>
                            item2._id.toString() === item1.servicerId.toString() ||
                            item2.resellerId === item1.servicerId
                    )
                    : null;
            const customerName =
                item1.customerId != null
                    ? respectiveCustomer.find(
                        (item2) => item2._id.toString() === item1.customerId.toString()
                    )
                    : null;
            const resellerName =
                item1.resellerId != null
                    ? respectiveReseller.find(
                        (item2) => item2._id.toString() === item1.resellerId.toString()
                    )
                    : null;
            if (dealerName || customerName || servicerName || resellerName) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerName: servicerName ? servicerName.toObject() : {},
                    dealerName: dealerName ? dealerName.toObject() : dealerName,
                    customerName: customerName ? customerName.toObject() : {},
                    resellerName: resellerName ? resellerName.toObject() : {},
                };
            } else {
                return {
                    dealerName: dealerName.toObject(),
                    servicerName: servicerName.toObject(),
                    customerName: customerName.toObject(),
                    resellerName: resellerName.toObject,
                };
            }
        });

        const unique_keyRegex = new RegExp(
            data.unique_key ? data.unique_key.trim() : "",
            "i"
        );
        const venderOrderRegex = new RegExp(
            data.venderOrder ? data.venderOrder.trim() : "",
            "i"
        );
        const status = new RegExp(data.status ? data.status.trim() : "", "i");

        let filteredData = result_Array.filter((entry) => {
            return (
                unique_keyRegex.test(entry.unique_key) &&
                venderOrderRegex.test(entry.venderOrder) &&
                status.test(entry.status)
            );
        });
        const updatedArray = filteredData.map((item) => ({
            ...item,
            servicerName: item.dealerName.isServicer
                ? item.dealerName
                : item.resellerName.isServicer
                    ? item.resellerName
                    : item.servicerName,
        }));

        const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
        const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
        const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
        const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
        const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
        const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
        const statusRegex = new RegExp(data.status ? data.status : '', 'i')

        const filteredData1 = updatedArray.filter(entry => {
            return (
                venderRegex.test(entry.venderOrder) &&
                orderIdRegex.test(entry.unique_key) &&
                dealerNameRegex.test(entry.dealerName.name) &&
                servicerNameRegex.test(entry.servicerName.name) &&
                customerNameRegex.test(entry.customerName.name) &&
                resellerNameRegex.test(entry.resellerName.name) &&
                statusRegex.test(entry.status)
            );
        });


        res.send({
            code: constant.successCode,
            message: 'Success',
            result: filteredData1
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getAllPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        data.status = typeof (data.status) == "string" ? "all" : data.status
        console.log(data)
        let categorySearch = req.body.category ? req.body.category : ''
        let queryCategories = {
            $and: [
                { isDeleted: false },
                { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
            ]
        };
        let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
        let catIdsArray = getCatIds.map(category => category._id)
        let searchName = req.body.name ? req.body.name : ''
        let query
        console.log("lklklkkklk", data.status)
        // let query ={'dealerId': new mongoose.Types.ObjectId(data.dealerId) };

        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'status': true },
                {
                    dealerId: new mongoose.Types.ObjectId(req.userId)
                }
            ]
        };



        //
        let projection = { isDeleted: 0, __v: 0 }

        let limit = req.body.limit ? req.body.limit : 10000
        let page = req.body.page ? req.body.page : 1
        const priceBooks = await dealerPriceService.getAllPriceBooksByFilter(query, projection, limit, page);
        if (!priceBooks) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: priceBooks
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.statusUpdate = async (req, res) => {
    try {
        // Check if the user has the required role
        if (req.role !== "Dealer") {
            res.send({
                code: constant.errorCode,
                message: "Only Dealer is allowed to perform this action"
            });
            return
        }

        // Fetch existing dealer price book data
        const criteria = { _id: req.params.dealerPriceBookId };
        const projection = { isDeleted: 0, __v: 0 };
        const existingDealerPriceBook = await dealerPriceService.getDealerPriceById(criteria, projection);

        if (!existingDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Dealer Price Book not found"
            });
            return;
        }
        // Prepare the update data
        const newValue = {
            $set: {
                brokerFee: req.body.brokerFee || existingDealerPriceBook.brokerFee,
                status: req.body.status,
                retailPrice: req.body.retailPrice || existingDealerPriceBook.retailPrice,
                priceBook: req.body.priceBook || existingDealerPriceBook.priceBook,
            }
        };

        const option = { new: true };

        // Update the dealer price status
        const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

        if (!updatedResult) {
            res.send({
                code: constant.errorCode,
                message: "Unable to update the dealer price status"
            });

            return;

        }
        res.send({
            code: constant.successCode,
            message: "Updated Successfully",
            data: updatedResult
        });

        return

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
        return
    }
};

exports.getResellerPriceBook = async (req, res) => {
    if (req.role != "Dealer") {
        res.send({
            code: constant.errorCode,
            message: "Only Dealer allow to do this action"
        })
        return;
    }
    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }

    let checkDealer = await dealerService.getDealerById(checkReseller.dealerId, { isDeleted: false });
    if (!checkDealer) {
        res.send({
            code: constant.errorCode,
            message: 'Dealer not found of this reseller!'
        });
        return;
    }

    let queryCategories = {
        $and: [
            { isDeleted: false },
            { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
        ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let projection = { isDeleted: 0, __v: 0 }
    let query = {
        $and: [
            { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
            { 'priceBooks.category._id': { $in: catIdsArray } },
            { 'status': true },
            {
                dealerId: new mongoose.Types.ObjectId(checkDealer._id)
            },
            {
                isDeleted: false
            }
        ]
    }
    //  let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(checkDealer._id), status: true }
    let getResellerPriceBook = await dealerPriceService.getAllPriceBooksByFilter(query, projection)
    if (!getResellerPriceBook) {
        res.send({
            code: constant.errorCode,
            message: 'Unable to find price books!'
        });
        return;
    }

    res.send({
        code: constant.successCode,
        message: "Success",
        result: getResellerPriceBook
    })


}

exports.getResellerUsers = async (req, res) => {
    if (req.role != "Dealer") {
        res.send({
            code: constant.errorCode,
            message: "Only Dealer allow to do this action"
        })
        return;
    }

    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }
    const queryUser = { accountId: { $in: checkReseller._id } }
    let users = await userService.getMembers(queryUser, { isDeleted: 0 });
    res.send({
        code: constant.successCode,
        data: users
    });
    return;
}
//servicers api

exports.getResellerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller ID"
            })
            return;
        }
        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        let result_Array = []
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: checkReseller.dealerId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }
        let ids = getServicersIds.map((item) => item.servicerId)
        var servicer = await providerService.getAllServiceProvider({ _id: { $in: ids } }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }

        if (checkReseller.isServicer) {
            //servicer = await providerService.getAllServiceProvider({ resellerId: checkReseller._id }, { isDeleted: 0 })
            servicer.unshift(checkReseller);
        }

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

        result_Array = servicer.map(servicer => {
            const matchingItem = servicerUser.find(user => user.accountId.toString() === servicer._id.toString())
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: servicer.toObject()
                };
            } else {
                return servicer.toObject();
            }
        })

        const nameRegex = new RegExp(data.name ? data.name.trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            data: filteredData
        });
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }



    // result_Array = servicerUser.map(item1 => {
    //     const matchingItem = servicer.find(item2 => item2._id.toString() === item1.accountId.toString());

    //     if (matchingItem) {
    //         return {
    //             ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
    //             servicerData: matchingItem.toObject()
    //         };
    //     } else {
    //         return servicerUser.toObject();
    //     }
    // });





}

exports.getDealerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.userId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }
        let ids = getServicersIds.map((item) => item.servicerId)
        console.log('%%%%%%%%%%%%%%%%%%%%%', ids)
        let servicer = await providerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }

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

        const result_Array = servicer.map(item1 => {
            const matchingItem = servicerUser.find(item2 => item2.accountId.toString() === item1._id.toString());

            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: item1.toObject()
                };
            } else {
                return servicerUser.toObject();
            }
        });

        const nameRegex = new RegExp(data.name ? data.name.trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicersList = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false, accountStatus: "Approved", status: true, dealerId: null, resellerId: null }
        let projection = { __v: 0, isDeleted: 0 }
        let servicer = await providerService.getAllServiceProvider(query, projection);


        let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.userId })

        const resultArray = servicer.map(item => {
            const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
            const documentData = item._doc;
            return { ...documentData, check: !!matchingServicer };
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: resultArray
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.createDeleteRelation = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }

        const trueArray = [];
        const falseArray = [];

        data.servicers.forEach(item => {
            if (item.status || item.status == "true") {
                trueArray.push(item);
            } else {
                falseArray.push(item);
            }
        });

        console.log('asdfadf++++++++++', trueArray, falseArray)

        let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
        let checkId = trueArray.map(record => record._id)
        const existingRecords = await dealerRelationService.getDealerRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: checkId }
        });

        // Step 2: Separate existing and non-existing servicer IDs
        const existingServicerIds = existingRecords.map(record => record.servicerId.toString());

        const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));

        console.log(')))))))))))))))))', existingRecords, existingServicerIds, checkId, newServicerIds)
        // Step 3: Delete existing records
        let deleteData = await dealerRelationService.deleteRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: uncheckId }
        });
        console.log('***************************', deleteData)
        // return res.json(deleteData)
        // Step 4: Insert new records
        const newRecords = newServicerIds.map(servicerId => ({
            dealerId: req.userId,
            servicerId: servicerId
        }));
        if (newRecords.length > 0) {
            let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
            res.send({
                code: constant.successCode,
                message: "successw"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "success"
            })
        }






        // for (let i = 0; i < data.servicers.length; i++) {
        //   let servicer = data.servicers[i]
        //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.userId })
        //   if (!checkRelation) {
        //     console.log('new------------')

        //   } else {
        //     console.log('delete------------')

        //   }
        // }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//customers api

exports.createCustomer = async (req, res, next) => {
    try {
        let data = req.body;
        let getCount = await customerService.getCustomersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer ID
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        // check reseller valid or not
        if (data.resellerName && data.resellerName != "") {
            var checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
            if (!checkReseller) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid Reseller."
                })
                return;
            }
        }

        // check customer acccount name 
        let checkAccountName = await customerService.getCustomerByName({
            username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: req.userId
        });
        if (checkAccountName) {
            res.send({
                code: constant.errorCode,
                message: "Customer already exist with this account name"
            })
            return;
        };

        let checkCustomerEmail = await userService.findOneUser({ email: data.email });
        if (checkCustomerEmail) {
            res.send({
                code: constant.errorCode,
                message: "Primary user email already exist"
            })
            return;
        }

        let customerObject = {
            username: data.accountName,
            street: data.street,
            city: data.city,
            dealerId: checkDealer._id,
            resellerId: checkReseller ? checkReseller._id : null,
            zip: data.zip,
            state: data.state,
            country: data.country,
            status: data.status,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }

        let teamMembers = data.members
        let emailsToCheck = teamMembers.map(member => member.email);
        let queryEmails = { email: { $in: emailsToCheck } };
        let checkEmails = await customerService.getAllCustomers(queryEmails, {});
        if (checkEmails.length > 0) {
            res.send({
                code: constant.errorCode,
                message: "Some email ids already exist"
            })
        }

        const createdCustomer = await customerService.createCustomer(customerObject);
        if (!createdCustomer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the customer"
            })
            return;
        };
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, roleId: '656f080e1eb1acda244af8c7' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)
        res.send({
            code: constant.successCode,
            message: "Customer created successfully",
            result: data
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getDealerCustomers = async (req, res) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            });
            return
        }
        let data = req.body
        let query = { isDeleted: false, dealerId: req.userId, status: true }
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id.toString());

        const customersOrderId = customers.map(obj => obj._id);
        const queryUser = { accountId: { $in: customersId }, isPrimary: true };


        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
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



        let orderQuery = { customerId: { $in: customersOrderId }, status: "Active" };

        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId")

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const order = ordersData.find(order => order._id.toString() === item1.accountId.toString())
            console.log("order===================", item1._id)
            if (matchingItem || order) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem.toObject(),
                    order: order ? order : {}
                };
            } else {
                return dealerData.toObject();
            }
        });
        let name = data.firstName ? data.firstName : ""
        let nameArray = name.split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };
        console.log('name check ++++++++++++++++++++++=', newObj)
        const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
        const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
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
}

exports.getCustomerInOrder = async (req, res) => {
    try {
        let data = req.body;
        let query;
        if (data.resellerId != "") {
            query = { dealerId: req, userId, resellerId: data.resellerId };
        } else {
            query = { dealerId: req.userId };
        }
        let getCustomers = await customerService.getAllCustomers(query, {});
        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers",
            });
            return;
        }

        res.send({
            code: constant.successCode,
            message: "Successfully Fetched",
            result: getCustomers,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.getServicerInOrders = async (req, res) => {
    let data = req.body;
    let servicer = [];
    if (req.userId) {
        var checkDealer = await dealerService.getDealerById(req.userId, {
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
            dealerId: req.userId,
        });
        // if (!getServicersIds) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Unable to fetch the servicer"
        //     })
        //     return;
        // }
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
        // if (!checkReseller) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Invalid Reseller ID"
        //     })
        //     return;
        // }
    }
    if (checkReseller && checkReseller.isServicer) {
        servicer.unshift(checkReseller);
    }

    if (checkDealer && checkDealer.isServicer) {
        servicer.unshift(checkDealer);
    }

    const servicerIds = servicer.map((obj) => obj._id);
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

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
            (item2) => item2.accountId.toString() === item1._id.toString()
        );

        if (matchingItem) {
            return {
                ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                servicerData: matchingItem.toObject(),
            };
        } else {
            return servicer.toObject();
        }
    });

    res.send({
        code: constant.successCode,
        result: result_Array,
    });
};



//dealers api


exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        let getCount = await resellerService.getResellersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: req.userId }, {})
        if (checkName) {
            res.send({
                code: constant.errorCode,
                message: "Reseller already exist with this account name"
            })
            return;
        };

        let checkCustomerEmail = await userService.findOneUser({ email: data.email });
        if (checkCustomerEmail) {
            res.send({
                code: constant.errorCode,
                message: "Primary user email already exist"
            })
            return;
        }

        let resellerObject = {
            name: data.accountName,
            street: data.street,
            city: data.city,
            dealerId: checkDealer._id,
            zip: data.zip,
            state: data.state,
            country: data.country,
            isServicer: data.isServicer ? data.isServicer : false,
            status: data.status,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }

        let teamMembers = data.members
        // let emailsToCheck = teamMembers.map(member => member.email);
        // let queryEmails = { email: { $in: emailsToCheck } };
        // let checkEmails = await customerService.getAllCustomers(queryEmails, {});
        // if (checkEmails.length > 0) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Some email ids already exist"
        //     })
        // }
        const createdReseler = await resellerService.createReseller(resellerObject);
        if (!createdReseler) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the reseller"
            })
            return;
        };
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdReseler._id, roleId: '65bb94b4b68e5a4a62a0b563' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)

        if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
                name: data.name,
                street: data.street,
                city: data.city,
                zip: data.zip,
                resellerId: createdReseler._id,
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
            message: "Reseller created successfully",
            result: data
        })


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getResellerOrders = async (req, res) => {
    try {
        // if (req.role != 'Dealer') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only dealer allow to do this action!'

        //     })
        //     return;
        // }
        let query = { _id: req.params.resellerId };
        let data = req.body
        let projection = { isDeleted: 0 }
        let checkReseller = await resellerService.getReseller(query, projection)
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found!'
            })
            return;
        }

        let project = {
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            unique_key_number: 1,
            unique_key_search: 1,
            servicerId: 1,
            customerId: 1,
            serviceCoverageType: 1,
            coverageType: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            createdAt: 1,
            venderOrder: 1,
            orderAmount: 1,
            contract: "$contract"
        };

        let orderQuery = { resellerId: new mongoose.Types.ObjectId(req.params.resellerId), status: { $ne: "Archieved" } }


        let lookupQuery = [
            {
                $match: orderQuery
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "_id",
                    foreignField: "orderId",
                    as: "contract"
                }
            },
            {
                $project: project,
            },
            {
                "$addFields": {
                    "noOfProducts": {
                        "$sum": "$productsArray.checkNumberProducts"
                    },
                    totalOrderAmount: { $sum: "$orderAmount" },
                    keki: {
                        $map: {
                            input: "$contract",
                            as: "contract",
                            in: {
                                $mergeObjects: [
                                    "$$contract",
                                    {
                                        startRange: "$startRange",
                                        endRange: "$endRange"
                                    }
                                ]
                            }
                        }
                    }

                }
            },
            { $sort: { unique_key: -1 } }
        ]



        let ordersResult = await orderService.getOrderWithContract(lookupQuery);
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId.toString());

        let mergedArray = userDealerIds.concat(userResellerIds);


        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        //Get Respective Dealers
        let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
            name: 1,
            isServicer: 1,
            city: 1,
            state: 1,
            country: 1,
            zip: 1,
            street: 1

        });
        let servicerIdArray = ordersResult.map((result) => result.servicerId);
        const servicerCreteria = {
            $or: [
                { _id: { $in: servicerIdArray } },
                { resellerId: { $in: servicerIdArray } },
                { dealerId: { $in: servicerIdArray } },
            ],
        };
        //Get Respective Servicer
        let respectiveServicer = await servicerService.getAllServiceProvider(
            servicerCreteria,
            {
                name: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1
            }
        );
        let customerIdsArray = ordersResult.map((result) => result.customerId);

        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId.toString());
        const customerCreteria = { _id: { $in: customerIdsArray } };

        const allUserIds = mergedArray.concat(userCustomerIds);

        // console.log("allUserIds==============",allUserIds);

        const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
        //Get Respective Customer
        let respectiveCustomer = await customerService.getAllCustomers(
            customerCreteria,
            {
                username: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1
            }
        );
        //Get all Reseller
        let resellerIdsArray = ordersResult.map((result) => result.resellerId);
        const resellerCreteria = { _id: { $in: resellerIdsArray } };
        let respectiveReseller = await resellerService.getResellers(
            resellerCreteria,
            {
                name: 1,
                isServicer: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1
            }
        );
        const result_Array = ordersResult.map((item1) => {
            const dealerName =
                item1.dealerId != ""
                    ? respectiveDealers.find(
                        (item2) => item2._id.toString() === item1.dealerId.toString()
                    )
                    : null;
            const servicerName =
                item1.servicerId != null
                    ? respectiveServicer.find(
                        (item2) =>
                            item2._id.toString() === item1.servicerId.toString() ||
                            item2.resellerId === item1.servicerId
                    )
                    : null;
            const customerName =
                item1.customerId != null
                    ? respectiveCustomer.find(
                        (item2) => item2._id.toString() === item1.customerId.toString()
                    )
                    : null;
            const resellerName =
                item1.resellerId != null
                    ? respectiveReseller.find(
                        (item2) => item2._id.toString() === item1.resellerId.toString()
                    )
                    : null;

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
                    resellerName: resellerName.toObject,
                };
            }
        });

        const unique_keyRegex = new RegExp(
            data.unique_key ? data.unique_key.trim() : "",
            "i"
        );
        const venderOrderRegex = new RegExp(
            data.venderOrder ? data.venderOrder.trim() : "",
            "i"
        );
        const status = new RegExp(data.status ? data.status.trim() : "", "i");

        let filteredData = result_Array.filter((entry) => {
            return (
                unique_keyRegex.test(entry.unique_key) &&
                venderOrderRegex.test(entry.venderOrder) &&
                status.test(entry.status)
            );
        });

        // const updatedArray = filteredData.map((item) => ({
        //     ...item,
        //     servicerName: item.dealerName.isServicer 
        //         ? item.dealerName
        //         : item.resellerName.isServicer
        //             ? item.resellerName
        //             : item.servicerName
        //         username:getPrimaryUser.find(user=>user.accountId.toString()===item.dealerName._id.toString())
        // }));

        const updatedArray = filteredData.map(item => {
            let username = null; // Initialize username as null
            if (item.dealerName) {
                username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
            }
            if (item.resellerName) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.resellerName._id.toString()) : {};
            }
            if (item.customerName) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.customerName._id.toString()) : {};
            }
            return {
                ...item,
                servicerName: item.dealerName.isServicer ? item.dealerName : item.resellerName.isServicer ? item.resellerName : item.servicerName,
                username: username, // Set username based on the conditional checks
                resellerUsername: resellerUsername ? resellerUsername : {},
                customerUserData: customerUserData ? customerUserData : {}
            };
        });
        let orderIdSearch = data.orderId ? data.orderId : ''
        const stringWithoutHyphen = orderIdSearch.replace(/-/g, "")
        const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen : '', 'i')
        const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
        const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
        const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
        const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
        const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
        const statusRegex = new RegExp(data.status ? data.status : '', 'i')

        const filteredData1 = updatedArray.filter(entry => {
            return (
                venderRegex.test(entry.venderOrder) &&
                orderIdRegex.test(entry.unique_key) &&
                dealerNameRegex.test(entry.dealerName.name) &&
                servicerNameRegex.test(entry.servicerName.name) &&
                customerNameRegex.test(entry.customerName.name) &&
                resellerNameRegex.test(entry.resellerName.name) &&
                statusRegex.test(entry.status)
            );
        });



        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData1,
        });
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })

    }
}


exports.getDealerResellers = async (req, res) => {
    try {
        // if (req.role != 'Dealer') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only dealer allow to do this action!'
        //     });
        //     return;
        // }
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.userId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.userId, status: true }
        let projection = { __v: 0 }
        const resellers = await resellerService.getResellers(query, projection);
        if (!resellers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the resellers"
            });
            return;
        };
        const resellerId = resellers.map(obj => obj._id.toString());
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
        //Get Reseller Orders

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

        let orderQuery = { resellerId: { $in: resellerOrderIds }, status: "Active" };

        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId")

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.accountId.toString())
            if (matchingItem || orders) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orders: orders ? orders : {}
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')

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
}


//order api

exports.getDealerOrders = async (req, res) => {
    try {
        {
            let data = req.body;
            if (req.role != "Dealer") {
                res.send({
                    code: constant.errorCode,
                    message: "Only dealer allow to do this action",
                });
                return;
            }

            let project = {
                productsArray: 1,
                dealerId: 1,
                unique_key: 1,
                unique_key_number: 1,
                unique_key_search: 1,
                servicerId: 1,
                customerId: 1,
                serviceCoverageType: 1,
                coverageType: 1,
                resellerId: 1,
                paymentStatus: 1,
                status: 1,
                createdAt: 1,
                venderOrder: 1,
                orderAmount: 1,
                contract: "$contract"
            };

            let query = { status: { $ne: "Archieved" }, dealerId: new mongoose.Types.ObjectId(req.userId) };

            let lookupQuery = [
                {
                    $match: query
                },

                // {
                //     $project: project,
                // },
                {
                    "$addFields": {
                        "noOfProducts": {
                            "$sum": "$productsArray.checkNumberProducts"
                        },
                        totalOrderAmount: { $sum: "$orderAmount" },
                        // flag: {
                        //     $cond: {
                        //         if: {
                        //             $and: [
                        //                 // { $eq: ["$payment.status", "paid"] },
                        //                 { $ne: ["$productsArray.orderFile.fileName", ''] },
                        //                 { $ne: ["$customerId", null] },
                        //                 { $ne: ["$paymentStatus", 'Paid'] },
                        //                 { $ne: ["$productsArray.coverageStartDate", null] },
                        //             ]
                        //         },
                        //         then: true,
                        //         else: false
                        //     }
                        // }

                    }
                },

                { $sort: { unique_key: -1 } }
            ]

            let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
            let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
            let limitData = Number(pageLimit)


            let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
            let dealerIdsArray = ordersResult.map((result) => result.dealerId);
            let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
            let userResellerIds = ordersResult
                .filter(result => result.resellerId !== null)
                .map(result => result.resellerId.toString());

            let mergedArray = userDealerIds.concat(userResellerIds);


            const dealerCreateria = { _id: { $in: dealerIdsArray } };
            //Get Respective Dealers
            let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
                name: 1,
                isServicer: 1,
                city: 1,
                state: 1,
                country: 1,
                zip: 1,
                street: 1

            });
            let servicerIdArray = ordersResult.map((result) => result.servicerId);
            const servicerCreteria = {
                $or: [
                    { _id: { $in: servicerIdArray } },
                    { resellerId: { $in: servicerIdArray } },
                    { dealerId: { $in: servicerIdArray } },
                ],
            };
            //Get Respective Servicer
            let respectiveServicer = await servicerService.getAllServiceProvider(
                servicerCreteria,
                {
                    name: 1,
                    city: 1,
                    state: 1,
                    country: 1,
                    zip: 1,
                    street: 1
                }
            );
            let customerIdsArray = ordersResult.map((result) => result.customerId);

            let userCustomerIds = ordersResult
                .filter(result => result.customerId !== null)
                .map(result => result.customerId.toString());
            const customerCreteria = { _id: { $in: customerIdsArray } };

            const allUserIds = mergedArray.concat(userCustomerIds);


            const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

            let getPrimaryUser = await userService.findUserforCustomer(queryUser)
            //Get Respective Customer
            let respectiveCustomer = await customerService.getAllCustomers(
                customerCreteria,
                {
                    username: 1,
                    city: 1,
                    state: 1,
                    country: 1,
                    zip: 1,
                    street: 1
                }
            );
            //Get all Reseller
            let resellerIdsArray = ordersResult.map((result) => result.resellerId);
            const resellerCreteria = { _id: { $in: resellerIdsArray } };
            let respectiveReseller = await resellerService.getResellers(
                resellerCreteria,
                {
                    name: 1,
                    isServicer: 1,
                    city: 1,
                    state: 1,
                    country: 1,
                    zip: 1,
                    street: 1
                }
            );


            const result_Array = ordersResult.map((item1) => {
                const dealerName =
                    item1.dealerId != ""
                        ? respectiveDealers.find(
                            (item2) => item2._id.toString() === item1.dealerId.toString()
                        )
                        : null;
                const servicerName =
                    item1.servicerId != null
                        ? respectiveServicer.find(
                            (item2) =>
                                item2._id.toString() === item1.servicerId.toString() ||
                                item2.resellerId === item1.servicerId
                        )
                        : null;
                const customerName =
                    item1.customerId != null
                        ? respectiveCustomer.find(
                            (item2) => item2._id.toString() === item1.customerId.toString()
                        )
                        : null;
                const resellerName =
                    item1.resellerId != null
                        ? respectiveReseller.find(
                            (item2) => item2._id.toString() === item1.resellerId.toString()
                        )
                        : null;

                if (dealerName || customerName || servicerName || resellerName) {
                    return {
                        ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                        dealerName: dealerName ? dealerName.toObject() : {},
                        servicerName: servicerName ? servicerName.toObject() : {},
                        customerName: customerName ? customerName.toObject() : {},
                        resellerName: resellerName ? resellerName.toObject() : {},
                    };
                } else {
                    return {
                        dealerName: {},
                        servicerName: {},
                        customerName: {},
                        resellerName: {},
                    };
                }
            });



            const unique_keyRegex = new RegExp(
                data.unique_key ? data.unique_key.trim() : "",
                "i"
            );
            const venderOrderRegex = new RegExp(
                data.venderOrder ? data.venderOrder.trim() : "",
                "i"
            );
            const status = new RegExp(data.status ? data.status.trim() : "", "i");

            let filteredData = result_Array.filter((entry) => {
                return (
                    unique_keyRegex.test(entry.unique_key) &&
                    venderOrderRegex.test(entry.venderOrder) &&
                    status.test(entry.status)
                );
            });

            const updatedArray = filteredData.map(item => {
                let isEmptyStartDate = item.productsArray.map(
                    (item1) => item1.coverageStartDate === null
                );
                let isEmptyOrderFile = item.productsArray
                    .map(
                        (item1) =>
                            item1.orderFile.fileName === ""
                    )
                item.flag = false
                const coverageStartDate = isEmptyStartDate.includes(true) ? false : true
                const fileName = isEmptyOrderFile.includes(true) ? false : true
                // console.log("isEmptyStartDate===================",isEmptyStartDate)
                // console.log("isEmptyOrderFile=====================",isEmptyOrderFile)
                //console.log(hasNullCoverageStartDate)
                if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
                    item.flag = true
                }
                let username = null; // Initialize username as null
                let resellerUsername = null; // Initialize username as null
                let customerUserData = null; // Initialize username as null
                if (item.dealerName._id) {
                    username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
                }
                if (item.resellerName._id) {
                    resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.resellerName._id.toString()) : {};
                }
                if (item.customerName._id) {
                    customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.customerName._id.toString()) : {};
                }
                return {
                    ...item,
                    servicerName: (item.dealerName.isServicer && item.servicerId != null) ? item.dealerName : (item.resellerName.isServicer && item.servicerId != null) ? item.resellerName : item.servicerName,
                    username: username, // Set username based on the conditional checks
                    resellerUsername: resellerUsername ? resellerUsername : {},
                    customerUserData: customerUserData ? customerUserData : {}
                };
            });


            let orderIdSearch = data.orderId ? data.orderId : ''
            const stringWithoutHyphen = orderIdSearch.replace(/-/g, "")
            const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen : '', 'i')
            const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
            const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
            const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
            const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
            const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
            const statusRegex = new RegExp(data.status ? data.status : '', 'i')

            const filteredData1 = updatedArray.filter(entry => {
                return (
                    venderRegex.test(entry.venderOrder) &&
                    orderIdRegex.test(entry.unique_key_search) &&
                    dealerNameRegex.test(entry.dealerName.name) &&
                    servicerNameRegex.test(entry.servicerName.name) &&
                    customerNameRegex.test(entry.customerName.name) &&
                    resellerNameRegex.test(entry.resellerName.name) &&
                    statusRegex.test(entry.status)
                );
            });



            res.send({
                code: constant.successCode,
                message: "Success",
                result: filteredData1,
            });
        };
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}


exports.getAllContracts = async (req, res) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            });
            return;
        }

        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        console.log(pageLimit, skipLimit, limitData)
        let query = [

            {
                $lookup: {
                    from: "orders",
                    localField: "orderId",
                    foreignField: "_id",
                    as: "order",
                    pipeline: [
                        {
                            $lookup: {
                                from: "dealers",
                                localField: "dealerId",
                                foreignField: "_id",
                                as: "dealer",
                            }
                        },
                        {
                            $lookup: {
                                from: "resellers",
                                localField: "resellerId",
                                foreignField: "_id",
                                as: "reseller",
                            }
                        },
                        {
                            $lookup: {
                                from: "customers",
                                localField: "customerId",
                                foreignField: "_id",
                                as: "customer",
                            }
                        },
                        {
                            $lookup: {
                                from: "servicers",
                                localField: "servicerId",
                                foreignField: "_id",
                                as: "servicer",
                            }
                        },

                    ]

                }
            },
            { $unwind: "$order" },

            { $match: { "order.dealerId": new mongoose.Types.ObjectId(req.userId) } }
        ]

        let getContracts = await contractService.getAllContracts(query, skipLimit, pageLimit)
        let getTotalCount = await contractService.findContractCount({ isDeleted: false })
        res.send({
            code: constant.successCode,
            message: "Success",
            result: getContracts,
            totalCount: getTotalCount
        })

        // res.send({
        //   code: constant.successCode,
        //   message: "Success!",
        //   result: checkOrder,
        //   contractCount: totalContract.length,
        //   orderUserData: userData
        // });


    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}


exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body;

        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
            dealerId: req.userId,
            status: true,
        });
        if (!getDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }
        // price book ids array from dealer price book
        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
        let query = { _id: { $in: dealerPriceIds } };
        // if(data.priceCatId){
        //     let categories =
        //     query = { _id: { $in: dealerPriceIds } ,}
        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {});

        const dealerPriceBookMap = new Map(
            getDealerPriceBook.map((item) => [
                item.priceBook.toString(),
                item.retailPrice,
            ])
        );

        // Update getPriceBook array with retailPrice from getDealerPriceBook
        let mergedPriceBooks = getPriceBooks.map((item) => {
            const retailPrice = dealerPriceBookMap.get(item._id.toString()) || 0;
            return {
                ...item._doc,
                retailPrice,
            };
        });


        //unique categories IDs from price books
        let uniqueCategory = {};
        let uniqueCategories = getPriceBooks.filter((item) => {
            if (!uniqueCategory[item.category.toString()]) {
                uniqueCategory[item.category.toString()] = true;
                return true;
            }
            return false;
        });

        uniqueCategories = uniqueCategories.map((item) => item.category);

        // get categories related to dealers
        let getCategories = await priceBookService.getAllPriceCat(
            { _id: { $in: uniqueCategories } },
            {}
        );

        // gettign selected category if user select the price book first
        let filteredPiceBook;
        let checkSelectedCategory;
        let dealerPriceBookDetail = {
            _id: "",
            priceBook: "",
            dealerId: "",
            status: "",
            retailPrice: "",
            description: "",
            isDeleted: "",
            brokerFee: "",
            unique_key: "",
            wholesalePrice: "",
            __v: 0,
            createdAt: "",
            updatedAt: "",
        };
        if (data.priceBookId || data.priceBookId != "") {
            filteredPiceBook = getPriceBooks
                .filter((item) => item._id.toString() === data.priceBookId)
                .map((item) => item.category);
            checkSelectedCategory = await priceBookService.getPriceCatByName({
                _id: filteredPiceBook,
            });

            dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({
                dealerId: req.params.dealerId,
                priceBook: data.priceBookId,
            });
        }

        if (data.priceCatId || data.priceCatId != "") {
            mergedPriceBooks = mergedPriceBooks.filter(
                (item) => item.category.toString() === data.priceCatId
            );
            checkSelectedCategory = await priceBookService.getPriceCatByName({
                _id: filteredPiceBook,
            });

            // dealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: req.params.dealerId, priceBook: data.priceBookId })
        }

        let result = {
            priceCategories: getCategories,
            priceBooks: mergedPriceBooks,
            selectedCategory: checkSelectedCategory ? checkSelectedCategory : "",
            dealerPriceBookDetail: dealerPriceBookDetail,
        };



        res.send({
            code: constant.successCode,
            message: "Success",
            result: result,
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};


exports.createOrder = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            let data = req.body;
            // let data = {
            //     "dealerId": "65ce11c8750ebbaea9330274",
            //     "servicerId": "",
            //     "customerId": "65cf188810d67d4db2c352a6",
            //     "resellerId": "",
            //     "productsArray": [
            //         {
            //             "categoryId": "65cf04494e8b028678173521",
            //             "priceBookId": "65cf04ba4e8b028678173522",
            //             "unitPrice": "80.00",
            //             "noOfProducts": "1",
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
            //             "QuantityPricing": '[{"name":"test","quantity":100,"_id":"65b123f200c340451867e281","enterQuantity":"7878"}]'

            //         }

            //     ],
            //     "sendNotification": true,
            //     "paymentStatus": "Paid",
            //     "dealerPurchaseOrder": "#136789777",
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
                    message: "Only super admin allow to do this action",
                });
                return;
            }
            // let hhhhh=data.productsArray[0].QuantityPricing.stringify()

            for (let i = 0; i < data.productsArray.length; i++) {
                if (data.productsArray[i].QuantityPricing) {
                    let jsonArray = JSON.parse(data.productsArray[i].QuantityPricing);
                    data.productsArray[i].QuantityPricing = jsonArray;
                }
            }

            data.resellerId = data.resellerId == 'null' ? null : data.resellerId;
            data.dealerId = req.userId
            data.venderOrder = data.dealerPurchaseOrder;
            let projection = { isDeleted: 0 };
            let checkDealer = await dealerService.getDealerById(
                req.userId,
                projection
            );
            if (!checkDealer) {
                res.send({
                    code: constant.errorCode,
                    message: "Dealer not found",
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
            let contractArrrayData = [];

            let count = await orderService.getOrdersCount();

            data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
            data.unique_key_search = "GC" + "2024" + data.unique_key_number
            data.unique_key = "GC-" + "2024-" + data.unique_key_number
            if (req.files) {
                const uploadedFiles = req.files.map((file) => ({
                    fileName: file ? file.filename : "",
                    name: file ? file.originalname : "",
                    filePath: file ? file.path : "",
                    size: file ? file.size : "",
                }));

                const filteredProducts = data.productsArray.filter(
                    (product) => product.file !== null
                );
                const filteredProducts2 = data.productsArray.filter(
                    (product) => product.file === null
                );

                const productsWithOrderFiles = filteredProducts.map(
                    (product, index) => {
                        const file = uploadedFiles[index];

                        // Check if 'file' is not null
                        if (file && file.filePath) {
                            return {
                                ...product,
                                file: file.filePath,
                                orderFile: {
                                    fileName: file.fileName,
                                    name: file.name,
                                    size: file.size,
                                },
                            };
                        } else {
                            // If 'file' is null, return the original product without modifications
                            return {
                                ...product,
                                orderFile: {
                                    fileName: "",
                                    name: "",
                                    size: "",
                                },
                            };
                        }
                    }
                );

                const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
                data.productsArray = finalOutput;
            }
            let checkVenderOrder = await orderService.getOrder(
                { venderOrder: data.dealerPurchaseOrder, dealerId: req.userId },
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


            // data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
            let savedResponse = await orderService.addOrder(data);
            if (!savedResponse) {
                res.send({
                    code: constant.errorCode,
                    message: "unable to create order",
                });
                return;
            }
            let fileLength = req.files ? req.files.length : 0;
            if (
                fileLength === data.productsArray.length &&
                data.customerId != null &&
                data.paymentStatus == "Paid"
            ) {


                let updateOrder = await orderService.updateOrder(
                    { _id: savedResponse._id },
                    { canProceed: true },
                    { new: true }
                );

                const isValidDate = data.productsArray.every((product) => {
                    const coverageStartDate =
                        product.coverageStartDate != ""
                            ? moment(product.coverageStartDate).format("YYYY-MM-DD")
                            : product.coverageStartDate;
                    return moment(coverageStartDate, "YYYY-MM-DD", true).isValid();
                });



                if (isValidDate) {
                    let updateStatus = await orderService.updateOrder(
                        { _id: savedResponse._id },
                        { status: "Active" },
                        { new: true }
                    );

                    let contractArrrayData = [];
                    for (let i = 0; i < data.productsArray.length; i++) {
                        let products = data.productsArray[i];
                        let priceBookId = products.priceBookId;
                        let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                        let projection = { isDeleted: 0 };
                        let priceBook = await priceBookService.getPriceBookById(
                            query,
                            projection
                        );
                        const wb = XLSX.readFile(products.file);
                        const sheets = wb.SheetNames;
                        const ws = wb.Sheets[sheets[0]];


                        // let contractCount =
                        //     Number(
                        //         count1.length > 0 && count1[0].unique_key
                        //             ? count1[0].unique_key
                        //             : 0
                        //     ) + 1;

                        const totalDataComing1 = XLSX.utils.sheet_to_json(ws);

                        const totalDataComing = totalDataComing1.map((item) => {
                            const keys = Object.keys(item);
                            return {
                                brand: item[keys[0]],
                                model: item[keys[1]],
                                serial: item[keys[2]],
                                condition: item[keys[3]],
                                retailValue: item[keys[4]],
                            };
                        });
                        // let savedDataOrder = savedResponse.toObject()
                        const matchedObject = await savedResponse.productsArray.find(product => product.orderFile.fileName == products.orderFile.fileName);
                        let count1 = await contractService.getContractsCount();
                        totalDataComing.forEach((data, index) => {
                            let unique_key_number1 = count1[0] ? count1[0].unique_key_number + index + 1 : 100000
                            let unique_key_search1 = "OC" + "2024" + unique_key_number1
                            let unique_key1 = "OC-" + "2024-" + unique_key_number1
                            let contractObject = {
                                orderId: savedResponse._id,
                                orderProductId: matchedObject._id,
                                productName: priceBook[0].name,
                                manufacture: data.brand,
                                model: data.model,
                                serial: data.serial,
                                condition: data.condition,
                                productValue: data.retailValue,
                                unique_key: unique_key1,
                                unique_key_number: unique_key_number1,
                                unique_key_search: unique_key_search1,
                            };
                            console.log("contractObject++++++++++++++++++++contractObject", matchedObject._id, contractObject)

                            contractArrrayData.push(contractObject);
                        });


                        console.log("Pushing data==================", contractArrrayData)

                        // let contractObject = {
                        //     orderId: savedResponse._id,
                        //     orderProductId: matchedObject._id,
                        //     productName: priceBook[0].name,
                        //     manufacture: totalDataComing[0]["brand"],
                        //     model: totalDataComing[0]["model"],
                        //     serial: totalDataComing[0]["serial"],
                        //     condition: totalDataComing[0]["condition"],
                        //     productValue: totalDataComing[0]["retailValue"],
                        //     unique_key: contractCount,
                        // };
                        // contractArrrayData.push(contractObject);
                    }
                    let bulkContracts = await contractService.createBulkContracts(
                        contractArrrayData
                    );
                }
            }
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};


























