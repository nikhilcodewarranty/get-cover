require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const orderService = require("../../Order/services/orderService");
const contractService = require("../../Contract/services/contractService");
const resellerService = require("../services/resellerService");
let claimService = require('../../Claim/services/claimService')
const LOG = require('../../User/model/logs')
const supportingFunction = require('../../config/supportingFunction')
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer")
const providerService = require("../../Provider/services/providerService")
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


exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        let getCount = await resellerService.getResellersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName }, {})
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
            status: true,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }
        // data.members[0].status = true
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
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdReseler._id, metaId: createdReseler._id, roleId: '65bb94b4b68e5a4a62a0b563' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)

        if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
                name: data.accountName,
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

exports.createCustomer = async (req, res, next) => {
    try {
        let data = req.body;
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller."
            })
            return;
        }
        let getCount = await customerService.getCustomersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer ID
        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };

        // check reseller valid or not
        // if (data.resellerName && data.resellerName != "") {
        //     var checkReseller = await resellerService.getReseller({ _id: data.resellerName }, {})
        //     if (!checkReseller) {
        //         res.send({
        //             code: constant.errorCode,
        //             message: "Invalid Reseller."
        //         })
        //         return;
        //     }
        // }

        // check customer acccount name 
        let checkAccountName = await customerService.getCustomerByName({
            username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName
        });
        // if (checkAccountName) {
        //   res.send({
        //     code: constant.errorCode,
        //     message: "Customer already exist with this account name"
        //   })
        //   return;
        // };

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
            resellerId1: checkReseller ? checkReseller._id : null,
            zip: data.zip,
            state: data.state,
            country: data.country,
            status: data.status,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }

        let teamMembers = data.members

        const emailSet = new Set();
        let isDuplicate = false;



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
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, metaId: createdCustomer._id, roleId: '656f080e1eb1acda244af8c7' }));
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
//Create Order
exports.createOrder = async (req, res) => {
    try {
        let data = req.body;

        const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
        let projection = { isDeleted: 0 };
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller."
            })
            return;
        }
        let checkDealer = await dealerService.getDealerById(
            checkReseller.dealerId,
            projection
        );

        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found",
            });
            return;
        }
        if (!checkDealer.accountStatus) {
            res.send({
                code: constant.errorCode,
                message: "Order can not be created, due to the dealer is inactive",
            });
            return;
        }

        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        data.resellerId = req.userId;
        data.venderOrder = data.dealerPurchaseOrder; 

        if (data.servicerId) {
            let query = {
                $or: [
                    { _id: data.servicerId },
                    { resellerId: data.servicerId },
                    { dealerId: data.servicerId },
                ],
            };

            let checkServicer = await providerService.getServiceProviderById(query);
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
        data.resellerId = req.userId;
        data.dealerId = checkReseller.dealerId;
        data.customerId = data.customerId != "" ? data.customerId : null;
        let count = await orderService.getOrdersCount();

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + "2024" + data.unique_key_number
        data.unique_key = "GC-" + "2024-" + data.unique_key_number

        let checkVenderOrder = await orderService.getOrder(
            { venderOrder: data.dealerPurchaseOrder, dealerId: checkDealer._id },
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
        console.log("data--------------------", data);

        if (data.billTo == "Dealer") {
            let getUser = await userService.getSingleUserByEmail({ accountId: checkDealer._id, isPrimary: true })
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
            let getUser = await userService.getSingleUserByEmail({ accountId: getReseller._id, isPrimary: true })
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

        let savedResponse = await orderService.addOrder(data);
        if (!savedResponse) {
            res.send({
                code: constant.errorCode,
                message: "unable to create order",
            });
            return;
        }
        let returnField = [];

        let checkOrder = await orderService.getOrder(
            { _id: savedResponse._id },
        );
        let uploadTermAndCondtion = await orderService.updateOrder(
            { _id: savedResponse._id },
            { termCondition: checkDealer?.termCondition },
            { new: true }
        );
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


        //send notification to admin and dealer 
        let IDs = await supportingFunction.getUserIds()
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
        if (data.resellerId) {
            let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: data.resellerId, isPrimary: true })
            IDs.push(resellerPrimary._id)
        }
        IDs.push(getPrimary._id)
        let notificationData = {
            title: "New order created",
            description: "The new order " + checkOrder.unique_key + " has been created",
            userId: checkDealer._id,
            contentId: null,
            flag: 'order',
            notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);

        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        notificationEmails.push(getPrimary.email);
        let emailData = {
            senderName: getPrimary.firstName,
            content: "The new order " + checkOrder.unique_key + "  has been created for " + getPrimary.firstName + "",
        }

        console.log("fsdfdfdsfdfsdsdds", notificationEmails);

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, "Create Order", emailData))


        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            console.log("All condition verify+++++++++++")
            let savedResponse = await orderService.updateOrder(
                { _id: checkOrder._id },
                { status: "Active" },
                { new: true }
            );
            console.log("order status update+++++++++++")
            let count1 = await contractService.getContractsCountNew();
            console.log("count1 New+++++++++++", count1)
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let mapOnProducts = savedResponse.productsArray.map(async (product, index) => {
                console.log('map on product+++++++++++++++++++++++++++++++++++++++++++=', new Date())
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                let priceBookId = product.priceBookId;
                let coverageStartDate = product.coverageStartDate;
                let coverageEndDate = product.coverageEndDate;
                let orderProductId = product._id;
                let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
                let projection = { isDeleted: 0 };
                let priceBook = await priceBookService.getPriceBookById(
                    query,
                    projection
                );
                const wb = XLSX.readFile(pathFile);
                const sheets = wb.SheetNames;
                const ws = wb.Sheets[sheets[0]];
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
                var contractArray = [];
                totalDataComing.forEach((data, index1) => {
                    console.log('index1++++++++++++++++++++++++++++++++++++++++++++=', new Date())
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + "2024" + unique_key_number1
                    let unique_key1 = "OC-" + "2024-" + unique_key_number1
                    let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
                    claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus

                    // -------------------------------------------------  copy from -----------------------------------------//

                    let dateCheck = new Date(product.coverageStartDate)
                    let adhDays = Number(product.adh ? product.adh : 0)
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
                    //let labourWarrantyDate = new Date(new Date(data.purchaseDate).setDate(new Date(data.purchaseDate).getMonth() + labourWarrantyMonth))
                    function findMinDate(d1, d2, d3) {
                        return new Date(Math.min(d1.getTime(), d2.getTime(), d3.getTime()));
                    }

                    // Find the minimum date
                    let minDate;
                    // let minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));

                    if (req.body.coverageType == "Breakdown") {
                        if (req.body.serviceCoverageType == "Labour") {

                            minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                            // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                            // }
                            // else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                            // }

                        } else if (req.body.serviceCoverageType == "Parts") {

                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));


                            // if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                            // } else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                            // }

                        } else {

                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));


                            // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                            // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                            // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                            // } else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                            // }
                        }
                    } else if (req.body.coverageType == "Accidental") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                        // if (req.body.serviceCoverageType == "Labour") {
                        //     if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                        //     } else {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                        //     }

                        // } else if (req.body.serviceCoverageType == "Parts") {
                        //     if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                        //     } else {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        //     }

                        // } else {
                        //     if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                        //     } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                        //     } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                        //     } else {
                        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        //     }
                        // }
                    } else {
                        if (req.body.serviceCoverageType == "Labour") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                            // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                            // }
                            // else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
                            // }

                        } else if (req.body.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                            // if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                            // } else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                            // }

                        } else {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));

                            // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                            // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                            // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

                            // } else {
                            //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                            // }
                        }
                    }
                    // let eligibilty = new Date(dateCheck) < new Date() ? true : false
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        pName: priceBook[0]?.pName,
                        minDate: minDate,
                        manufacture: data.brand,
                        model: data.model,
                        // partsWarranty: data.partsWarranty1,
                        partsWarranty: partsWarrantyDate1,
                        labourWarranty: labourWarrantyDate1,
                        serviceCoverageType: req.body.serviceCoverageType,
                        coverageType: req.body.coverageType,
                        serial: data.serial,
                        orderUniqueKey: savedResponse.unique_key,
                        venderOrder: savedResponse.venderOrder,
                        coverageStartDate: coverageStartDate,
                        coverageEndDate: coverageEndDate,
                        status: claimStatus,
                        eligibilty: eligibilty,
                        productValue: data.retailValue,
                        condition: data.condition,
                        productValue: data.retailValue,
                        unique_key: unique_key1,
                        unique_key_search: unique_key_search1,
                        unique_key_number: unique_key_number1,
                    };
                    increamentNumber++
                    //unique_key_number1++
                    // console.log("unique_key_number1", contractObject)

                    contractArray.push(contractObject);
                    //let saveData = contractService.createContract(contractObject)
                });
                console.log('after loop ++++++++++++++++++++++++++++++++++++++++++++=', new Date())

                let saveContracts = await contractService.createBulkContracts(contractArray);

                //send notification to dealer,reseller,admin,customer
                let IDs = await supportingFunction.getUserIds()
                let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.dealerId, isPrimary: true })
                let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.customerId, isPrimary: true })
                let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.resellerId, isPrimary: true })
                if (resellerPrimary) {
                    IDs.push(resellerPrimary?._id)
                }
                IDs.push(dealerPrimary._id, customerPrimary._id)
                let notificationData1 = {
                    title: "Order update and processed",
                    description: "The order has been update and processed",
                    userId: req.userId,
                    contentId: savedResponse._id,
                    flag: 'order',
                    notificationFor: IDs
                };
                let createNotification = await userService.createNotification(notificationData1);


                // Send Email code here
                let notificationEmails = await supportingFunction.getUserEmails();
                notificationEmails.push(customerPrimary.email);
                notificationEmails.push(dealerPrimary.email);
                notificationEmails.push(resellerPrimary?.email);
                let emailData = {
                    senderName: '',
                    content: "The order " + savedResponse.unique_key + " has been updated and processed",
                }

                let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, "Order Processed", emailData))


                //  console.log("saveContracts==================", saveContracts)

            })
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        } else {
            res.send({
                code: constant.successCode,
                message: "Success",
            });
        }

        // })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};
exports.getAllResellers = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false }
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

        //console.log("ordersData=================",ordersData);

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

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            console.log('search check ++++++++++++', entry)
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.resellerData.dealerName) &&
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

exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller."
            })
            return;
        }
        data.venderOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        let checkId = await orderService.getOrder({ _id: req.params.orderId });
        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid order ID",
            });
            return;
        }
        let checkDealer = await dealerService.getDealerById(
            checkReseller.dealerId
        );
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found",
            });
            return;
        }
        if (!checkDealer.accountStatus) {
            res.send({
                code: constant.errorCode,
                message: "Order can not be process, due to the dealer is inactive",
            });
            return;
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
        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = req.userId;
        data.customerId = data.customerId != "" ? data.customerId : null;

        if (checkId.paymentStatus == "Paid" && data.paymentStatus == "PartlyPaid") {
            checkId.paidAmount = 0
        }
        if (data.paymentStatus == "Paid") {
            data.paidAmount = checkId.orderAmount
            data.dueAmount = 0
        }
        data.paidAmount = Number(data.paidAmount)
        data.dueAmount = Number(checkId.orderAmount) - Number(data.paidAmount)
        console.log('order paid check +++++++++++++++++++++++=', Number(data.paidAmount), Number(checkId.orderAmount))
        if (Number(data.paidAmount) > Number(checkId.orderAmount)) {
            res.send({
                code: constant.error,
                message: "Not a valid paying amount"
            })
            return;
        };

        if (Number(data.paidAmount) == Number(checkId.orderAmount)) {
            console.log("condition matched +++++++++++++++++++===")
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
        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            data,
            { new: true }
        );
        if (!savedResponse) {
            res.send({
                code: constant.errorCode,
                message: "unable to create order",
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


        // if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
        //     let savedResponse = await orderService.updateOrder(
        //         { _id: req.params.orderId },
        //         { status: "Active" },
        //         { new: true }
        //     );

        //     //let count1 = await contractService.getContractsCount();
        //     let count1 = await contractService.getContractsCountNew();
        //     var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
        //     let save = savedResponse.productsArray.map(async (product) => {
        //         const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
        //         let priceBookId = product.priceBookId;
        //         let coverageStartDate = product.coverageStartDate;
        //         let coverageEndDate = product.coverageEndDate;
        //         let orderProductId = product._id;
        //         let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
        //         let projection = { isDeleted: 0 };
        //         let priceBook = await priceBookService.getPriceBookById(
        //             query,
        //             projection
        //         );
        //         const wb = XLSX.readFile(pathFile);
        //         const sheets = wb.SheetNames;
        //         const ws = wb.Sheets[sheets[0]];
        //         let count1 = await contractService.getContractsCount();
        //         let contractCount =
        //             Number(
        //                 count1.length > 0 && count1[0].unique_key
        //                     ? count1[0].unique_key
        //                     : 0
        //             ) + 1;

        //         const totalDataComing1 = XLSX.utils.sheet_to_json(ws);
        //         const totalDataComing = totalDataComing1.map((item) => {
        //             const keys = Object.keys(item);
        //             return {
        //                 brand: item[keys[0]],
        //                 model: item[keys[1]],
        //                 serial: item[keys[2]],
        //                 condition: item[keys[3]],
        //                 retailValue: item[keys[4]],
        //             };
        //         });
        //         // let savedDataOrder = savedResponse.toObject()

        //         var contractArray = [];
        //         totalDataComing.forEach((data, index) => {
        //             //let unique_key_number1 = count1[0]?.unique_key_number ? count1[0].unique_key_number + index + 1 : 100000
        //             let unique_key_number1 = increamentNumber
        //             let unique_key_search1 = "OC" + "2024" + unique_key_number1
        //             let unique_key1 = "OC-" + "2024-" + unique_key_number1
        //             let claimStatus = new Date(product.coverageStartDate) < new Date() ? "Active" : "Waiting"
        //             claimStatus = new Date(product.coverageEndDate) < new Date() ? "Expired" : claimStatus
        //             let eligibilty = claimStatus == "Active" ? true : false
        //             let contractObject = {
        //                 orderId: savedResponse._id,
        //                 orderUniqueKey: savedResponse.unique_key,
        //                 venderOrder: savedResponse.venderOrder,
        //                 orderProductId: orderProductId,
        //                 coverageStartDate: coverageStartDate,
        //                 coverageEndDate: coverageEndDate,
        //                 productName: priceBook[0].name,
        //                 manufacture: data.brand,
        //                 model: data.model,
        //                 status: claimStatus,
        //                 eligibilty: eligibilty,
        //                 serial: data.serial,
        //                 condition: data.condition,
        //                 productValue: data.retailValue,
        //                 unique_key: unique_key1,
        //                 unique_key_search: unique_key_search1,
        //                 unique_key_number: unique_key_number1,
        //             };
        //             contractArray.push(contractObject);
        //             increamentNumber++;
        //             //let saveData = contractService.createContract(contractObject)
        //         });

        //         await contractService.createBulkContracts(contractArray);

        //     })

        //     res.send({
        //         code: constant.successCode,
        //         message: "Success",
        //     });
        // } else {
        //     res.send({
        //         code: constant.successCode,
        //         message: "Success",
        //     });
        // }

        //     let checkPriceBook = await priceBookService.findByName1(query)
        //     if (!checkPriceBook) {
        //         res.send({
        //             code: constant.errorCode,
        //             message: "PriceBook not found"
        //         })
        //         return;
        //     }
        // }

        // let data = req.body
        res.send({
            code: constant.successCode,
            message: "Success",
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};

exports.getCategoryAndPriceBooks = async (req, res) => {
    try {
        let data = req.body;
        const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller."
            })
            return;
        }
        //check dealer id to get price book
        let getDealerPriceBook = await dealerPriceService.findAllDealerPrice({
            dealerId: checkReseller.dealerId,
            status: true,
        });
        if (!getDealerPriceBook) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data",
            });
            return;
        }
        if (!data.coverageType) {
            res.send({
                code: constant.errorCode,
                message: "Coverage type is required",
            });
            return;
        }

        let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
       

        let query;
        if (data.term != "" && data.pName == "") {
            query = { _id: { $in: dealerPriceIds }, status: true, term: data.term, coverageType: data.coverageType };
        }
        else if (data.pName != "" && data.term == "") {
            query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, coverageType: data.coverageType };

        } else if (data.term != "" && data.pName != "") {
            query = { _id: { $in: dealerPriceIds }, status: true, pName: data.pName, term: data.term, coverageType: data.coverageType };
        } else {
            query = { _id: { $in: dealerPriceIds }, coverageType: data.coverageType, status: true, };
        }

        console.log('query+++++++++++++++++++++++++',query)
        // price book ids array from dealer price book
        // let dealerPriceIds = getDealerPriceBook.map((item) => item.priceBook);
        // let query = { _id: { $in: dealerPriceIds } };
        // if(data.priceCatId){
        //     let categories =
        //     query = { _id: { $in: dealerPriceIds } ,}
        // }

        let getPriceBooks = await priceBookService.getAllPriceIds(query, {});
        if (data.priceBookId || data.priceBookId != "") {
             getPriceBooks = await priceBookService.getAllPriceIds({ _id: data.priceBookId }, {});
            console.log("price book ak-------",getPriceBooks)
            data.term = getPriceBooks[0]?.term ? getPriceBooks[0].term : ""
            data.pName = getPriceBooks[0]?.pName ? getPriceBooks[0].pName : ""
        }
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
                dealerId: checkReseller.dealerId,
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



        const uniqueTerms = [...new Set(mergedPriceBooks.map(item => item.term))].map(term => ({
            label: Number(term) / 12 === 1 ? Number(term) / 12 + " Year" : Number(term) / 12 + " Years",
            value: term
        })).sort((a, b) => a.value - b.value)

        const uniqueProductName = [...new Set(mergedPriceBooks.map(item => item?.pName))].map(pName => ({
            pName: pName,
        }));

        let result = {
            priceCategories: getCategories,
            priceBooks: data.priceCatId == "" ? [] : mergedPriceBooks,
            productName: data.priceCatId == "" ? [] : uniqueProductName,
            terms: data.priceCatId == "" ? [] : uniqueTerms,
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
exports.getResellerByDealerId = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }
    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { accountStatus: 1 });

    //result.metaData = singleDealer
    if (!dealers) {
        res.send({
            code: constant.errorCode,
            message: "Dealer not found"
        });
        return;
    };
    let resellerData = await resellerService.getResellers({ dealerId: req.params.dealerId }, { isDeleted: 0 })
    const resellerIds = resellerData.map(reseller => reseller._id.toString())
    const queryUser = { accountId: { $in: resellerIds }, isPrimary: true };
    let getPrimaryUser = await userService.findUserforCustomer(queryUser)
    const result_Array = getPrimaryUser.map(item1 => {
        const matchingItem = resellerData.find(item2 => item2._id.toString() === item1.accountId.toString());

        if (matchingItem) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                resellerData: matchingItem.toObject()
            };
        } else {
            return resellerData.toObject();
        }
    });
    res.send({
        code: constant.successCode,
        message: "Success",
        result: result_Array
    });
}

exports.getResellerById = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }
    let checkReseller = await resellerService.getResellers({ _id: req.userId }, { isDeleted: 0 });

    if (!checkReseller[0]) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found'
        })
        return;
    }
    let checkDealerStatus = await dealerService.getDealerByName({ _id: checkReseller[0].dealerId })
    const query1 = { accountId: { $in: [checkReseller[0]._id] }, isPrimary: true };
    let resellerUser = await userService.getMembers(query1, { isDeleted: false })
    if (!resellerUser) {
        res.send({
            code: constant.errorCode,
            message: 'Primary user not found of this reseller'
        })
        return;
    }

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
            { resellerId: { $in: [checkReseller[0]._id] }, status: "Active" },
        ]
    }
    let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId");

    //Get Claim Result 
    const claimQuery = { claimFile: 'Completed' }

    let lookupQuery = [
        {
            $match: claimQuery
        },
        {
            $lookup: {
                from: "contracts",
                localField: "contractId",
                foreignField: "_id",
                as: "contracts",
            }
        },
        {
            $unwind: "$contracts"
        },
        {
            $lookup: {
                from: "orders",
                localField: "contracts.orderId",
                foreignField: "_id",
                as: "contracts.orders",
            },

        },
        {
            $unwind: "$contracts.orders"
        },
        {
            $match:
            {
                $and: [
                    // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                    { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.userId) },
                ]
            },
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
    let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

    const rejectedQuery = { claimFile: { $ne: "Rejected" } }
    //Get number of claims
    let numberOfCompleletedClaims = [
        {
            $match: rejectedQuery
        },
        {
            $lookup: {
                from: "contracts",
                localField: "contractId",
                foreignField: "_id",
                as: "contracts",
            }
        },
        {
            $unwind: "$contracts"
        },
        {
            $lookup: {
                from: "orders",
                localField: "contracts.orderId",
                foreignField: "_id",
                as: "contracts.orders",
            },

        },
        {
            $unwind: "$contracts.orders"
        },
        {
            $match:
            {
                $and: [
                    // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                    { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.userId) },
                ]
            },
        },
    ]
    let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
    const claimData = {
        numberOfClaims: numberOfClaims.length,
        valueClaim: valueClaim[0]?.totalAmount
    }
    const result_Array = resellerUser.map(user => {
        let matchItem = checkReseller.find(reseller => reseller._id.toString() == user.accountId.toString());
        let order = ordersResult.find(order => order._id.toString() === user.accountId.toString())
        if (matchItem || order) {
            return {
                ...user.toObject(),
                resellerData: matchItem.toObject(),
                orderData: order ? order : {},
                claimData: claimData
            }
        }
        else {
            return {
                ...user.toObject(),
                resellerData: {}
            }
        }
    })

    res.send({
        code: constant.successCode,
        message: "Success",
        reseller: result_Array,
        dealerStatus: checkDealerStatus.accountStatus
    })


}

exports.getResellerUsers = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }

    let data = req.body

    let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }
    const queryUser = {
        $and: [
            { accountId: { $in: checkReseller._id } },
            { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { phoneNumber: { '$regex': data.phone ? data.phone : '', '$options': 'i' } },
        ]
    }
    console.log('skdsdjsdk---------------', queryUser, data)
    let users = await userService.getMembers(queryUser, { isDeleted: 0 });
    res.send({
        code: constant.successCode,
        data: users,
        resellerStatus: checkReseller.status,
        isAccountCreate: checkReseller.isAccountCreate

    });
    return;
}

exports.getResellerDetails = async (req, res) => {
    try {
        if (req.role != "Reseller") {
            res.send({
                code: constant.errorCode,
                message: "Only reseller allow to do this action"
            })
            return;
        }
        let data = req.body
        let getUser = await userService.getUserById1({ _id: req.teammateId })
        let mid = new mongoose.Types.ObjectId(req.userId)
        let query = [
            {
                $match: {
                    _id: mid
                }
            },
            {
                $lookup: {
                    from: "dealers",
                    foreignField: "_id",
                    localField: "dealerId",
                    as: "dealer"
                }
            },
            { $unwind: { path: "$dealer", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: 1,
                    street: 1,
                    city: 1,
                    zip: 1,
                    state: 1,
                    country: 1,
                    isServicer: 1,
                    "dealer.name": 1,
                    "dealer.street": 1,
                    "dealer.city": 1,
                    "dealer.zip": 1,
                    "dealer.state": 1,
                    "dealer.country": 1,
                    "dealer.isServicer": 1,
                }
            }
        ]
        let getCustomer = await resellerService.getResellerByAggregate(query)
        if (!getCustomer[0]) {
            res.send({
                code: Constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Successfully fetched user details.",
            result: getCustomer[0],
            loginMember: getUser
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getResellerCustomers = async (req, res) => {
    try {
        if (req.role !== "Reseller") {
            res.send({
                code: constant.errorCode,
                message: "Only reseller is allowed to perform this action"
            });
            return
        }
        let data = req.body;
        let query = { isDeleted: false, resellerId: req.userId }
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
                    orderData: order ? order : {
                        noOfOrders: 0,
                        orderAmount: 0
                    }
                };
            } else {
                return {};
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
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
};

exports.getResellerPriceBook = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }
    let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 })
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
            { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
        ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let projection = { isDeleted: 0, __v: 0 }
    let query



    let data = req.body
    if (checkDealer.coverageType == "Breakdown & Accidental") {
        if (data.coverageType == "") {
            query = {
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
        } else {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'status': true },
                    { 'priceBooks.coverageType': data.coverageType },

                    {
                        dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                    },
                    {
                        isDeleted: false
                    }
                ]
            }
        }
    } else {
        if (data.coverageType == "") {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.category._id': { $in: catIdsArray } },
                    { 'priceBooks.coverageType': checkDealer.coverageType },
                    { 'status': true },
                    {
                        dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                    },
                    {
                        isDeleted: false
                    }
                ]
            }
        } else {
            query = {
                $and: [
                    { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                    { 'priceBooks.coverageType': data.coverageType },
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
        }

    }

    if (data.term != '') {
        query.$and.push({ 'priceBooks.term': Number(data.term) });
    }

    if (data.priceType != '') {
        query.$and.push({ 'priceBooks.priceType': data.priceType });
        if (data.priceType == 'Flat Pricing') {
            if (data.range != '') {
                query.$and.push({ 'priceBooks.rangeStart': { $lte: Number(data.range) } });
                query.$and.push({ 'priceBooks.rangeEnd': { $gte: Number(data.range) } });
            }

            // const flatQuery = {
            //   $and: [
            //     { 'rangeStart': { $lte: Number(data.range) } },
            //     { 'rangeEnd': { $gte: Number(data.range) } }, 
            //   ]
            // } 
            // query.$and.push(flatQuery);
        }
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

exports.editResellers = async (req, res) => {
    try {
        let data = req.body
        let criteria = { _id: req.userId }
        let option = { new: true }

        let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 });
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid reseller ID"
            })
            return;
        }
        if (data.oldName != data.accountName) {
            let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName }, {})
            if (checkName) {
                res.send({
                    code: constant.errorCode,
                    message: "Reseller already exist with this account name"
                })
                return;
            };
        }
        data.name = data.accountName
        let updateReseller = await resellerService.updateReseller(criteria, data)
        if (checkReseller.isServicer) {
            const updateServicerMeta = await providerService.updateServiceProvider({ resellerId: req.userId }, data)
        }
        if (!updateReseller) {
            res.send({
                code: constant.errorCode,
                message: "Unable to update the data"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: updateReseller
        })

    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.addResellerUser = async (req, res) => {
    try {
        let data = req.body
        let checkReseller = await resellerService.getReseller({ _id: data.resellerId }, {})
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller ID"
            })
            return;
        };
        let checkEmail = await userService.findOneUser({ email: data.email }, {})
        if (checkEmail) {
            res.send({
                code: constant.errorCode,
                message: "User already exist with this email"
            })
            return;
        }
        data.accountId = checkReseller._id
        data.metaId = checkReseller._id
        data.roleId = '65bb94b4b68e5a4a62a0b563'

        let statusCheck;
        if (!checkReseller.status) {
            statusCheck = false
        } else {
            statusCheck = data.status
        }
        data.status = statusCheck
        let saveData = await userService.createUser(data)
        if (!saveData) {
            //Save Logs add user
            let logData = {
                userId: req.userId,
                endpoint: "resellerPortal/addResellerUser",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to add the data"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to add the data"
            })
        } else {
            //Save Logs add user
            let logData = {
                userId: req.userId,
                endpoint: "resellerPortal/addResellerUser",
                body: data,
                response: {
                    code: constant.successCode,
                    message: "Added successfully",
                    result: saveData
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Added successfully",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs add user
        let logData = {
            userId: req.userId,
            endpoint: "resellerPortal/addResellerUser catch",
            body: req.body ? req.body : { "type": "Catch Error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getResellerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkReseller = await resellerService.getReseller({ _id: req.userId })
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

        // Get servicer with claim
        const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: { $ne: "Rejected" } };

        const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "Completed" };

        let valueClaim = await claimService.getServicerClaimsValue(servicerCompleted, "$servicerId");
        let numberOfClaims = await claimService.getServicerClaimsNumber(servicerClaimsIds, "$servicerId");

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
            const claimValue = valueClaim.find(claim => claim._id.toString() === servicer._id.toString())
            const claimNumber = numberOfClaims.find(claim => claim._id.toString() === servicer._id.toString())
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: servicer.toObject(),
                    claimValue: claimValue ? claimValue : {
                        totalAmount: 0
                    },
                    claimNumber: claimNumber ? claimNumber : { noOfOrders: 0 }
                };
            } else {
                return servicer.toObject();
            }
        })

        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

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
            data: filteredData,
            resellerStatus: checkReseller.status
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

exports.getResselerByCustomer = async (req, res) => {
    try {
        // if (req.role != "Super Admin") {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Only super admin allow to do this action"
        //     })
        //     return;
        // }
        let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, { isDeleted: 0 })
        if (!checkCustomer) {
            res.send({
                code: constant.errorCode,
                message: 'Customer not found!'
            });
            return;
        }

        let checkReseller = await resellerService.getReseller({ _id: checkCustomer.resellerId });

        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found of this customer!'
            })
        }

        res.send({
            code: constant.successCode,
            data: checkReseller
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }


}

exports.getDealerByReseller = async (req, res) => {
    try {
        // if (req.role != "Super Admin") {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Only super admin allow to do this action"
        //     })
        //     return;
        // }

        let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 });
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found'
            });
            return;
        }

        let dealer = await dealerService.getDealerById(checkReseller.dealerId, { isDeleted: 0 });

        res.send({
            code: constant.successCode,
            result: dealer
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }

}

exports.getCustomerInOrder = async (req, res) => {
    try {
        let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 });
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found'
            });
            return;
        }
        let query = { dealerId: checkReseller.dealerId, resellerId: checkReseller._id };

        let getCustomers = await customerService.getAllCustomers(query, {});

        if (!getCustomers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customers",
            });
            return;
        }
        console.log(" getCustomers --------------", getCustomers)
        const customerIds = getCustomers.map(customer => customer._id.toString());
        console.log("customerUser00000000000000000", customerIds);
        let query1 = { accountId: { $in: customerIds }, isPrimary: true };
        let projection = { __v: 0, isDeleted: 0 }

        let customerUser = await userService.getMembers(query1, projection)

        const result_Array = customerUser.map(item1 => {
            const matchingItem = getCustomers.find(item2 => item2._id.toString() === item1.accountId.toString());
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(),
                    email: item1.email  // Use toObject() to convert Mongoose document to plain JavaScript object
                };
            } else {
                return dealerData.toObject();
            }
        });

        res.send({
            code: constant.successCode,
            message: "Successfully Fetched",
            result: result_Array,
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
    let checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: 0 });
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found'
        });
        return;
    }
    let servicer = [];
    if (checkReseller.dealerId) {
        var checkDealer = await dealerService.getDealerById(checkReseller.dealerId, {
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
            dealerId: checkReseller.dealerId,
        });
        let ids = getServicersIds.map((item) => item.servicerId);
        servicer = await providerService.getAllServiceProvider(
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
            (item2) => item2.accountId?.toString() === item1._id?.toString());
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

exports.getResellerOrders = async (req, res) => {
    try {
        // if (req.role != 'Super Admin') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only super admin allow to do this action!'

        //     })
        //     return;
        // }
        let query = { _id: req.userId };
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
        // let project = {
        //     productsArray: 1,
        //     dealerId: 1,
        //     unique_key: 1,
        //     servicerId: 1,
        //     customerId: 1,
        //     resellerId: 1,
        //     paymentStatus: 1,
        //     status: 1,
        //     venderOrder: 1,
        //     orderAmount: 1,
        // }

        // let orderQuery = { resellerId: new mongoose.Types.ObjectId(req.userId), status: { $ne: "Archieved" } }
        // let ordersResult = await orderService.getAllOrders(orderQuery, project)

        let query1 = { status: { $ne: "Archieved" }, resellerId: new mongoose.Types.ObjectId(req.userId) };

        let lookupQuery = [
            {
                $match: query1
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
                    flag: {
                        $cond: {
                            if: {
                                $and: [
                                    // { $eq: ["$payment.status", "paid"] },
                                    { $ne: ["$productsArray.orderFile.fileName", ''] },
                                    { $ne: ["$customerId", null] },
                                    { $ne: ["$paymentStatus", 'Paid'] },
                                    { $ne: ["$productsArray.coverageStartDate", null] },
                                ]
                            },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            { $sort: { unique_key: -1 } }
        ]

        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)


        let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
        //Get Respective dealer
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId?.toString());

        let mergedArray = userDealerIds.concat(userResellerIds);
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
        let respectiveServicer = await providerService.getAllServiceProvider(
            servicerCreteria,
            { name: 1 }
        );

        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId?.toString());

        const allUserIds = mergedArray.concat(userCustomerIds);


        const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
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
                            item2._id.toString() === item1.servicerId?.toString() ||
                            item2.resellerId === item1.servicerId
                    )
                    : null;
            const customerName =
                item1.customerId != null
                    ? respectiveCustomer.find(
                        (item2) => item2._id.toString() === item1.customerId?.toString()
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
                    resellerName: resellerName.toObject(),
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
        //             : item.servicerName,
        // }));

        const updatedArray = filteredData.map(item => {
            let username = null; // Initialize username as null
            let resellerUsername = null
            let customerUserData = null
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
            if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
                item.flag = true
            }
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
                servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
                username: username, // Set username based on the conditional checks
                resellerUsername: resellerUsername ? resellerUsername : {},
                customerUserData: customerUserData ? customerUserData : {}
            };
        });

        const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
        const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
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

// exports.getResellerContract = async (req, res) => {
//     try {
//         let data = req.body
//         let getResellerOrder = await orderService.getOrders({ resellerId: req.userId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
//         if (!getResellerOrder) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the data"
//             })
//             return
//         }
//         let orderIDs = getResellerOrder.map((ID) => ID._id)
//         let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//         let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//         let limitData = Number(pageLimit)
//         let newQuery = [];
//         let matchedData = []
//         data.servicerName = data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : ''


//         if (data.customerName != "") {
//             newQuery.push(
//                 {
//                     $lookup: {
//                         from: "dealers",
//                         localField: "order.dealerId",
//                         foreignField: "_id",
//                         as: "order.dealer"
//                     }
//                 },
//                 // {
//                 //   $match: {
//                 //     $and: [
//                 //       { "order.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 //     ]
//                 //   },
//                 // }
//             );
//             matchedData.push({ "order.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//         }
//         if (data.servicerName != "") {
//             newQuery.push(
//                 {
//                     $lookup: {
//                         from: "serviceproviders",
//                         localField: "order.servicerId",
//                         foreignField: "_id",
//                         as: "order.servicer"
//                     }
//                 },
//                 // {
//                 //   $match: {
//                 //     $and: [
//                 //       { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 //     ]
//                 //   },
//                 // }
//             );
//             matchedData.push({ "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//         }
//         if (matchedData.length > 0) {
//             let matchedCondition = {
//                 $match: {
//                     $and: matchedData
//                 }
//             };
//             newQuery.push(matchedCondition);
//         }
//         newQuery.push(
//             {
//                 $facet: {
//                     totalRecords: [
//                         {
//                             $count: "total"
//                         }
//                     ],
//                     data: [
//                         {
//                             $skip: skipLimit
//                         },
//                         {
//                             $limit: pageLimit
//                         },
//                         {
//                             $project: {
//                                 productName: 1,
//                                 model: 1,
//                                 serial: 1,
//                                 unique_key: 1,
//                                 status: 1,
//                                 manufacture: 1,
//                                 eligibilty: 1,
//                                 // "order.unique_key": 1,
//                                 // "order.venderOrder": 1,
//                                 // "order.resellerId": 1,
//                                 order_unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                 order_venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                 resellerId: { $arrayElemAt: ["$order.resellerId", 0] },
//                                 order: {
//                                     unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                     venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                     resellerId: { $arrayElemAt: ["$order.resellerId", 0] },
//                                 },
//                                 totalRecords: 1
//                             }
//                         }
//                     ],
//                 },

//             })

//         let contractFilter = []
//         if (data.eligibilty != '') {
//             contractFilter = [
//                 { orderId: { $in: orderIDs } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { eligibilty: data.eligibilty === "true" ? true : false },
//             ]
//         } else {
//             contractFilter = [
//                 // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//                 { orderId: { $in: orderIDs } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//         }

//         let query = [
//             {
//                 $match:
//                 {
//                     $and: contractFilter
//                 },
//             },
//             {
//                 $lookup: {
//                     from: "orders",
//                     localField: "orderId",
//                     foreignField: "_id",
//                     as: "order",
//                 }
//             },
//             {
//                 $match:
//                 {
//                     $and: [
//                         { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         { "order.resellerId": new mongoose.Types.ObjectId(req.userId) },
//                     ]
//                 },

//             },

//         ]
//         if (newQuery.length > 0) {
//             query = query.concat(newQuery);
//         }
//         let getContracts = await contractService.getAllContracts2(query)

//         let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

//         res.send({
//             code: constant.successCode,
//             message: "Success",
//             result: getContracts[0]?.data ? getContracts[0]?.data : [],
//             totalCount
//         })

//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message
//         })
//     }
// }

exports.getResellerContract = async (req, res) => {
    try {
        let data = req.body
        console.log("data------------------", data)
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
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
            let getData = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (getData.length > 0) {
                servicerIds = await getData.map(servicer => servicer._id)
            } else {
                servicerIds.push("1111121ccf9d400000000000")
            }
        };

        let orderAndCondition = []
        if (customerIds.length > 0) {
            orderAndCondition.push({ customerId: { $in: customerIds } })

        }
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })

        }
        if (req.role == 'Reseller') {
            userSearchCheck = 1
            orderAndCondition.push({ resellerId: { $in: [req.userId] } })
        };

        console.log("orderAndCondition-------------------", orderAndCondition)
        let orderIds = []
        if (orderAndCondition.length > 0) {
            let getOrders = await orderService.getOrders({
                $and: orderAndCondition
            })
            if (getOrders.length > 0) {
                orderIds = await getOrders.map(order => order._id)
            }
        }
        console.log("getOrders-------------------", orderIds)
        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
            console.log('check_--------dssssssssssssssssssssss--------')
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
                                    minDate: 1,
                                    serial: 1,
                                    unique_key: 1,
                                    status: 1,
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
                                unique_key: 1,
                                status: 1,
                                minDate: 1,
                                manufacture: 1,
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


        // console.log("sssssss", contractFilterWithPaging)

        let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

        res.send({
            code: constant.successCode,
            message: "Success",
            result: getContracts[0]?.data ? getContracts[0]?.data : [],
            totalCount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.changeResellerStatus = async (req, res) => {
    try {

        const singleReseller = await resellerService.getReseller({ _id: req.userId });

        let data = req.body;

        if (!singleReseller) {
            res.send({
                code: constant.errorCode,
                message: "Reseller not found"
            })
            return;
        }
        //Update Reseller User Status if inactive
        if (!req.body.status) {
            let resellerUserCreateria = { accountId: req.userId };
            let newValue = {
                $set: {
                    status: req.body.status
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);

        }

        else {
            let resellerUserCreateria = { accountId: req.userId, isPrimary: true };
            let newValue = {
                $set: {
                    status: req.body.status
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);
        }

        option = { new: true };
        //Update Reseller Status
        newValue = {
            $set: {
                status: req.body.status
            }
        };
        const changedResellerStatus = await resellerService.updateReseller({ _id: req.userId }, newValue);
        if (changedResellerStatus) {
            //Save Logs change status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus",
                body: data,
                response: {
                    code: constant.successCode,
                    message: 'Updated Successfully!',
                    data: changedResellerStatus
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: 'Updated Successfully!',
                data: changedResellerStatus
            })
        }
        else {
            //Save Logs change status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: 'Unable to update reseller status!',
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: 'Unable to update reseller status!',
            })
        }
    } catch (err) {
        //Save Logs change status
        let logData = {
            userId: req.userId,
            endpoint: "reseller/changeResellerStatus catch",
            body: req.body ? req.body : { "type": "Catch Error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getResellerClaims = async (req, res) => {
    try {

        const singleReseller = await resellerService.getReseller({ _id: req.userId });

        if (!singleReseller) {
            res.send({
                code: constant.errorCode,
                message: "Reseller not found"
            })
            return;
        }
        let data = req.body
        let query = { isDeleted: false };
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let newQuery = [];
        newQuery.push({
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
                        $lookup: {
                            from: "servicer_dealer_relations",
                            localField: "contracts.orders.dealers._id",
                            foreignField: "dealerId",
                            as: "contracts.orders.dealers.dealerServicer",
                        }
                    },
                    {
                        $lookup: {
                            from: "resellers",
                            localField: "contracts.orders.resellerId",
                            foreignField: "_id",
                            as: "contracts.orders.resellers",
                        }
                    },
                    {
                        $lookup: {
                            from: "serviceproviders",
                            localField: "contracts.orders.servicerId",
                            foreignField: "_id",
                            as: "contracts.orders.servicers",
                        }
                    },
                    {
                        $project: {
                            "contractId": 1,
                            "claimFile": 1,
                            "lossDate": 1,
                            "receiptImage": 1,
                            reason: 1,
                            "unique_key": 1,
                            note: 1,
                            claimType: 1,
                            totalAmount: 1,
                            servicerId: 1,
                            pName: 1,
                            customerStatus: 1,
                            trackingNumber: 1,
                            trackingType: 1,
                            repairParts: 1,
                            diagnosis: 1,
                            claimStatus: 1,
                            repairStatus: 1,
                            // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
                            "contracts.unique_key": 1,
                            "contracts.productName": 1,
                            "contracts.model": 1,
                            "contracts.manufacture": 1,
                            "contracts.serial": 1,
                            "contracts.orders.dealerId": 1,
                            "contracts.orders._id": 1,
                            "contracts.orders.servicerId": 1,
                            "contracts.orders.serviceCoverageType": 1,
                            "contracts.orders.coverageType": 1,
                            "contracts.orders.customerId": 1,
                            "contracts.orders.dealers.isShippingAllowed": 1,
                            "contracts.orders.resellerId": 1,
                            "contracts.orders.dealers.name": 1,
                            "contracts.orders.dealers.isServicer": 1,
                            "contracts.orders.dealers._id": 1,
                            "contracts.orders.customer.username": 1,
                            // "contracts.orders.dealers.dealerServicer": 1,
                            "contracts.orders.dealers.dealerServicer": {
                                $map: {
                                    input: "$contracts.orders.dealers.dealerServicer",
                                    as: "dealerServicer",
                                    in: {
                                        "_id": "$$dealerServicer._id",
                                        "servicerId": "$$dealerServicer.servicerId",
                                    }
                                }
                            },
                            "contracts.orders.servicers": {
                                $map: {
                                    input: "$contracts.orders.servicers",
                                    as: "servicer",
                                    in: {
                                        "_id": "$$servicer._id",
                                        "name": "$$servicer.name",
                                    }
                                }
                            },
                            "contracts.orders.resellers": {
                                $map: {
                                    input: "$contracts.orders.resellers",
                                    as: "reseller",
                                    in: {
                                        "_id": "$$reseller._id",
                                        "name": "$$reseller.name",
                                        "isServicer": "$$reseller.isServicer"
                                    }
                                }
                            }
                        }
                    },

                ]
            }
        })
        let lookupQuery = [
            { $sort: { unique_key_number: -1 } },
            {
                $match:
                {
                    $and: [
                        // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
                        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        // { isDeleted: false },
                        { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                    ]
                },
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "contractId",
                    foreignField: "_id",
                    as: "contracts",
                }
            },
            {
                $unwind: "$contracts"
            },
            {
                $match:
                {
                    $and: [
                        // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
                        { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                    ]
                },
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "contracts.orderId",
                    foreignField: "_id",
                    as: "contracts.orders",
                },
            },
            {
                $unwind: "$contracts.orders"
            },
            {
                $match:
                {
                    $and: [
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                        { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.userId) },
                        // { "contracts.orders.isDeleted": false },
                    ]
                },
            },
            {
                $lookup: {
                    from: "dealers",
                    localField: "contracts.orders.dealerId",
                    foreignField: "_id",
                    as: "contracts.orders.dealers",
                }
            },
            {
                $unwind: "$contracts.orders.dealers"
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "contracts.orders.customerId",
                    foreignField: "_id",
                    as: "contracts.orders.customer",

                }
            },
            {
                $unwind: "$contracts.orders.customer"
            },
            {
                $match:
                {
                    $and: [
                        { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        // { "contracts.orders.customer.isDeleted": false },
                    ]
                },
            },

        ]
        if (newQuery.length > 0) {
            lookupQuery = lookupQuery.concat(newQuery);
        }

        let allClaims = await claimService.getAllClaims(lookupQuery);

        let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

        let allServicerIds = [];
        // Iterate over the data array
        resultFiter.forEach(item => {
            // Iterate over the dealerServicer array in each item
            item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
                // Push the servicerId to the allServicerIds array
                allServicerIds.push(dealer.servicerId);
            });
        });

        //Get Dealer and Reseller Servicers
        // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
        let servicer;
        let servicerName = '';
        // console.log("servicerIds=================", allServicerIds);
        // res.json(resultFiter)
        // return
        allServicer = await providerService.getAllServiceProvider(
            { _id: { $in: allServicerIds }, status: true },
            {}
        );
        const result_Array = resultFiter.map((item1) => {
            servicer = []
            let servicerName = '';
            let selfServicer = false;
            let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
                const dealerOfServicer = allServicer.find(servicer => servicer?._id.toString() === matched.servicerId.toString());
                servicer.push(dealerOfServicer)
            });
            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }
            if (item1.contracts.orders.resellers?.isServicer) {
                servicer.unshift(item1.contracts.orders.resellers)
            }
            if (item1.contracts.orders.dealers.isServicer) {
                servicer.unshift(item1.contracts.orders.dealers)
            }
            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer?._id.toString() === item1.servicerId.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
            }
            return {
                ...item1,
                servicerData: servicerName,
                selfServicer: selfServicer,
                contracts: {
                    ...item1.contracts,
                    allServicer: servicer
                }
            }
        })
        let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
        res.send({
            code: constant.successCode,
            message: "Success",
            result: result_Array,
            totalCount
        })



    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

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

        let query = { status: 'Active', resellerId: new mongoose.Types.ObjectId(req.userId) };
        const claimQuery = { claimFile: 'Completed' }
        let checkOrders = await orderService.getDashboardData(query, project);
        //Get claims data
        let lookupQuery = [
            {
                $match: claimQuery
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "contractId",
                    foreignField: "_id",
                    as: "contracts",
                }
            },
            {
                $unwind: "$contracts"
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "contracts.orderId",
                    foreignField: "_id",
                    as: "contracts.orders",
                },

            },
            {
                $unwind: "$contracts.orders"
            },
            {
                $match:
                {
                    $and: [
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.userId) },
                    ]
                },
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
        let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

        const rejectedQuery = { claimFile: { $ne: "Rejected" } }
        //Get number of claims
        let numberOfCompleletedClaims = [
            {
                $match: claimQuery
            },
            {
                $lookup: {
                    from: "contracts",
                    localField: "contractId",
                    foreignField: "_id",
                    as: "contracts",
                }
            },
            {
                $unwind: "$contracts"
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "contracts.orderId",
                    foreignField: "_id",
                    as: "contracts.orders",
                },

            },
            {
                $unwind: "$contracts.orders"
            },
            {
                $match:
                {
                    $and: [
                        // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.userId) },
                    ]
                },
            },
        ]
        let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim.length > 0 ? valueClaim[0]?.totalAmount : 0
        }
        if (!checkOrders[0] && numberOfClaims.length == 0 && valueClaim.length == 0) {
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
                // result: {
                //     "_id": "",
                //     "totalAmount": 0,
                //     "totalOrder": 0
                // }
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: {
                claimData: claimData,
                orderData: checkOrders[0]
            }
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};
