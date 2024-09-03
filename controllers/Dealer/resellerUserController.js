require('dotenv').config()
const USER = require('../../models/User/users')
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService");
const contractService = require("../../services/Contract/contractService");
const resellerService = require("../../services/Dealer/resellerService");
let claimService = require('../../services/Claim/claimService')
const LOG = require('../../models/User/logs')
const supportingFunction = require('../../config/supportingFunction')
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerRelation = require("../../models/Provider/dealerServicer")
const providerService = require("../../services/Provider/providerService")
const userService = require("../../services/User/userService");
const role = require("../../models/User/role");
const dealer = require("../../models/Dealer/dealer");
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
const reportingController = require("../../controllers/User/reportingController");

//Create Reseller
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
        let teamMembers = data.members
        const createdReseler = await resellerService.createReseller(resellerObject);

        if (!createdReseler) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the reseller"
            })
            return;
        };

        teamMembers = teamMembers.map(member => ({ ...member, metaId: createdReseler._id, roleId: '65bb94b4b68e5a4a62a0b563' }));
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

//Create custmer from reseller
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

        // check customer acccount name 
        let checkAccountName = await customerService.getCustomerByName({
            username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName
        });

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

        teamMembers = teamMembers.map(member => ({ ...member, metaId: createdCustomer._id, roleId: process.env.customer }));
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
        if (data.billTo == "Dealer") {
            let getUser = await userService.getSingleUserByEmail({ metaId: checkDealer._id, isPrimary: true })
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
            let getUser = await userService.getSingleUserByEmail({ metaId: getReseller._id, isPrimary: true })
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
        let savedResponse = await orderService.addOrder(data);

        if (!savedResponse) {
            let logData = {
                endpoint: "resellerPortal/createOrder",
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

        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);
        //send notification to admin and dealer 
        let IDs = await supportingFunction.getUserIds()
        let getPrimary = await supportingFunction.getPrimaryUser({ metaId: checkDealer._id, isPrimary: true })
        if (data.resellerId) {
            let resellerPrimary = await supportingFunction.getPrimaryUser({ metaId: data.resellerId, isPrimary: true })
            IDs.push(resellerPrimary._id)
        }
        IDs.push(getPrimary._id)
        let notificationData = {
            title: "New order created",
            description: "The new order " + checkOrder.unique_key + " has been created",
            userId: req.teammateId,
            contentId: null,
            flag: 'order',
            notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);
        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        let settingData = await userService.getSetting({});
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.firstName,
            content: "The new order " + checkOrder.unique_key + "  has been created for " + getPrimary.firstName + "",
            subject: "New Order"
        }

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))
        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let savedResponse = await orderService.updateOrder(
                { _id: checkOrder._id },
                { status: "Active" },
                { new: true }
            );
            let count1 = await contractService.getContractsCountNew();
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let mapOnProducts = savedResponse.productsArray.map(async (product, index) => {
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
                    function findMinDate(d1, d2, d3) {
                        return new Date(Math.min(d1.getTime(), d2.getTime(), d3.getTime()));
                    }

                    // Find the minimum date
                    let minDate;
                    if (req.body.coverageType == "Breakdown") {
                        if (req.body.serviceCoverageType == "Labour" || req.body.serviceCoverageType == "Labor") {
                            minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                        } else if (req.body.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

                        } else {
                            minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    } else if (req.body.coverageType == "Accidental") {
                        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
                    } else {
                        if (req.body.serviceCoverageType == "Labour" || req.body.serviceCoverageType == "Labor") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

                        } else if (req.body.serviceCoverageType == "Parts") {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
                        } else {
                            minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
                        }
                    }
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        pName: priceBook[0]?.pName,
                        minDate: minDate,
                        manufacture: data.brand,
                        model: data.model,
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
                    contractArray.push(contractObject);
                });

                let saveContracts = await contractService.createBulkContracts(contractArray);
                //send notification to dealer,reseller,admin,customer
                let IDs = await supportingFunction.getUserIds()
                let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.dealerId, isPrimary: true })
                let customerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.customerId, isPrimary: true })
                let resellerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.resellerId, isPrimary: true })
                if (resellerPrimary) {
                    IDs.push(resellerPrimary?._id)
                }
                IDs.push(dealerPrimary._id, customerPrimary._id)
                let notificationData1 = {
                    title: "Order update and processed",
                    description: "The order has been update and processed",
                    userId: req.teammateId,
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
                    darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                    lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                    address: settingData[0]?.address,
                    websiteSetting: settingData[0],
                    senderName: '',
                    content: "The order " + savedResponse.unique_key + " has been updated and processed",
                    subject: "Order Processed"
                }

                let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, [], emailData))

            })

            let logData = {
                endpoint: "resellerPortal/createOrder",
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
                message: "Success",
            });
        } else {
            let logData = {
                endpoint: "resellerPortal/createOrder",
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
                message: "Success",
            });
        }

        // })
    } catch (err) {
        let logData = {
            endpoint: "resellerPortal/createOrder",
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
            message: err.message
        })
    }
};

//edit order details
exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        let logData = {
            endpoint: "resellerPortal/editOrderDetail",
            body: data,
            userId: req.userId,
            response: {}
        };
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
                let checkServicer = await providerService.getServiceProviderById(query);
                if (!checkServicer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Servicer not found",
                    });
                    return;
                }
            }
        }
        if (data.customerId != "" || data.customerId != null) {
            if (data.customerId != checkId.customerId) {
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
        if (checkId.status == "Active") {
            res.send({
                code: constant.errorCode,
                message: "The order has already  active",
            });
            return;
        }
        if (checkId.status == "Archieved") {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived",
            });
            return;
        }
        if (data.billTo == "Dealer") {
            let getUser = await userService.getSingleUserByEmail({ metaId: checkDealer._id, isPrimary: true })
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
            let getReseller = await resellerService.getReseller({ _id: checkReseller._id })
            let getUser = await userService.getSingleUserByEmail({ metaId: getReseller._id, isPrimary: true })
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
        if (Number(data.paidAmount) > Number(checkId.orderAmount)) {
            res.send({
                code: constant.error,
                message: "Not a valid paying amount"
            })
            return;
        };

        if (Number(data.paidAmount) == Number(checkId.orderAmount)) {
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

        if (checkId.paymentStatus != "Unpaid") {
            if (Number(data.orderAmount) > Number(checkId.orderAmount)) {
                data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
                data.paymentStatus = "PartlyPaid"
            }
            if (Number(data.orderAmount) < Number(checkId.orderAmount)) {
                let checkDue = Number(data.orderAmount) - Number(checkId.paidAmount)
                if (checkDue <= 0) {
                    data.dueAmount = 0
                    data.paymentStatus = "Paid"
                } else {
                    data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
                    data.paymentStatus = "PartlyPaid"
                }

            }
        }

        let savedResponse = await orderService.updateOrder(
            { _id: req.params.orderId },
            data,
            { new: true }
        );
        if (!savedResponse) {
            logData.response = {
                code: constant.errorCode,
                message: "unable to update order",
            };
            await LOG(logData).save();
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
        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: checkOrder.dealerId, isPrimary: true })
        IDs.push(dealerPrimary._id)
        let notificationData = {
            title: "Order update",
            description: "The order " + checkOrder.unique_key + " has been updated",
            userId: req.teammateId,
            contentId: checkOrder._id,
            flag: 'order',
            notificationFor: IDs
        };
        let createNotification = await userService.createNotification(notificationData);

        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        //Email to Dealer
        let settingData = await userService.getSetting({});
        //Email to Dealer
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: dealerPrimary.firstName,
            content: "The  order " + checkOrder.unique_key + " has been updated",
            subject: "Order Update"
        }

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
        logData.response = {
            code: constant.successCode,
            message: "Success",
        };
        await LOG(logData).save();

        res.send({
            code: constant.successCode,
            message: "Success",
        });
    } catch (err) {
        //Save Logs for create price book
        let logData = {
            userId: req.userId,
            endpoint: "resellerPortal/editOrderDetail catch",
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

//Edit reseller
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

//Add reseller user
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

//change reseler status
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
            let resellerUserCreateria = { metaId: req.userId };
            let newValue = {
                $set: {
                    status: req.body.status
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);

        }

        else {
            let resellerUserCreateria = { metaId: req.userId, isPrimary: true };
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

//Get sales reporting
exports.saleReporting = async (req, res) => {
    try {

        let bodyData = req.body
        bodyData.returnValue = {
            total_broker_fee: 0,
            total_admin_fee: 0,
            total_fronting_fee: 0,
            total_reserve_future_fee: 0,
            total_contracts: 0,
            total_reinsurance_fee: 0,
            wholesale_price: 0
        };
        bodyData.role = req.role
        let checkReseller = await resellerService.getReseller({ _id: req.userId })
        bodyData.dealerId = new mongoose.Types.ObjectId(checkReseller.dealerId)
        if (bodyData.flag == "daily") {
            let sales = await reportingController.dailySales1(bodyData)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: sales
            })
        } else if (bodyData.flag == "weekly") {
            let sales = await reportingController.weeklySales(bodyData)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: sales
            })
        } else if (bodyData.flag == "day") {
            let sales = await reportingController.daySale(bodyData)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: sales
            })
        } else {
            res.send({
                code: constant.successCode,
                result: [],
                message: "Invalid flag value"
            })
        }

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get claim reporting
exports.claimReporting = async (req, res) => {
    try {
        let data = req.body
        let checkReseller = await resellerService.getReseller({ _id: req.userId })

        let returnValue = {
            weekStart: 1,
            total_amount: 1,
            total_claim: 1,
            total_unpaid_amount: 1,
            total_unpaid_claim: 1,
            total_paid_amount: 1,
            total_paid_claim: 1,
            total_rejected_claim: 1
        };

        data.returnValue = returnValue
        data.role = req.role
        data.isServicer = checkReseller.isServicer

        if (data.flag == "daily") {
            data.dealerId = checkReseller.dealerId
            let claim = await reportingController.claimDailyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim
            })
        } else if (data.flag == "weekly") {
            data.dealerId = checkReseller.dealerId
            let claim = await reportingController.claimWeeklyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim
            })
        } else if (data.flag == "day") {
            data.dealerId = checkReseller.dealerId
            let claim = await reportingController.claimDayReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim,
                isServicer: checkReseller.isServicer
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Get  drop label for reporting
exports.saleReportinDropDown = async (req, res) => {
    try {
        let data = req.body
        let result;
        let checkReseller = await resellerService.getReseller({ _id: req.userId })

        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })

        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 0, name: 1, pName: 1, coverageType: 1 })

        const convertedData = getDealers.map(item => ({
            value: item._id,
            label: item.name
        }));

        let priceBook = getPriceBooks.map(item => ({
            value: item._id,
            label: item.name
        }));

        let categories = getCategories.map(item => ({
            value: item._id,
            label: item.name
        }));

        result = {
            getPriceBooks: priceBook,
            getCategories: categories
        }

        data.dealerId = checkReseller.dealerId

        if (data.dealerId != "") {
            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })
            priceBook = getPriceBooks1.map(item => ({
                value: item._id,
                label: item.name
            }));
            categories = getCategories1.map(item => ({
                value: item._id,
                label: item.name
            }));
            result = {
                getPriceBooks: priceBook,
                getCategories: categories
            }
            if (data.categoryId != "") {
                let getPriceBooks2 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                result = {
                    getPriceBooks: priceBook,
                    getCategories: categories
                }
            }
        }

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

//Get claim reporting dropdown
exports.claimReportinDropdown = async (req, res) => {
    try {
        let data = req.body
        let result;

        let checkReseller = await resellerService.getReseller({ _id: req.userId })
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: checkReseller._id })
        let ids = getServicersIds?.map((item) => item.servicerId)
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }) // not using
        let getServicer = await providerService.getAllServiceProvider({
            $or: [
                { dealerId: checkReseller.dealerId },
                {
                    $and: [
                        { accountStatus: "Approved" }, { _id: { $in: ids } }
                    ]
                }
            ]
        })
        let getCategories = await priceBookService.getAllPriceCat({}, { name: 1, _id: 1 })
        let getPriceBooks = await priceBookService.getAllPriceIds({}, { _id: 0, name: 1, pName: 1, coverageType: 1 })

        result = {
            servicers: getServicer,
            priceBooks: getPriceBooks,
            categories: getCategories
        }

        if (data.primary == "servicer") {
            let servicerId;
            if (data.servicerId != "") {
                servicerId = [new mongoose.Types.ObjectId(req.body.servicerId)]
            } else {
                servicerId = getServicer.map(ID => new mongoose.Types.ObjectId(ID._id))
            }

            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: checkReseller._id })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })

            if (data.categoryId != "") {
                getPriceBooks1 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
            }
            if (data.priceBookId.length != 0) {
                getCategories1 = []
            }

            result = {
                priceBooks: getPriceBooks1,
                servicers: getServicer,
                categories: getCategories1
            }

        }

        if (data.primary == "category") {
            if (data.categoryId != "") {
                getPriceBooks = await priceBookService.getAllPriceIds({ category: data.categoryId })
            }

            if (data.priceBookId.length != 0) {
                getCategories = []
            }

            result = {
                servicers: [],
                priceBooks: getPriceBooks,
                categories: getCategories
            }

        }
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
};

