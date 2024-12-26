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
const aws = require('aws-sdk');
aws.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
});
const S3Bucket = new aws.S3();



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
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
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
        let settingData = await userService.getSetting({});

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

        teamMembers = teamMembers.map(member => ({
            ...member,
            metaData:
                [
                    {
                        firstName: member.firstName,
                        lastName: member.lastName,
                        phoneNumber: member.phoneNumber,
                        metaId: createdCustomer._id,
                        roleId: process.env.customer,
                        position: member.position,
                        dialCode: member.dialCode,
                        status: member.status,
                        isPrimary: member.isPrimary
                    }
                ],
            approvedStatus: "Approved",

        })
        );
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)

        const adminQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "customerNotifications.customerAdded": true },
                        { status: true },
                        { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                    ]
                }
            },
        }
        const dealerQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "customerNotifications.customerAdded": true },
                        { status: true },
                        { metaId: new mongoose.Types.ObjectId(checkReseller.dealerId) },
                    ]
                }
            },
        }
        const resellerQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "customerNotifications.customerAdded": true },
                        { status: true },
                        { metaId: new mongoose.Types.ObjectId(checkReseller._id) },


                    ]
                }
            },
        }

        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        const resellerId = resellerUsers.map(user => user._id)
        // Primary User Welcoime email
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)
        let resellerEmails = resellerUsers.map(user => user.email)
        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        //Send Notification to customer,admin,reseller,dealer 
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })

        let notificationArray = []
        //Send Notification to customer,admin,reseller,dealer 
        let notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: IDs,
            redirectionId: "customerDetails/" + createdCustomer._id,
            endpoint: base_url + "customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by $${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: dealerId,
            redirectionId: "dealer/customerDetails/" + createdCustomer._id,
            endpoint: base_url + "dealer/customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by $${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: resellerId,
            redirectionId: "reseller/customerDetails/" + createdCustomer._id,
            endpoint: base_url + "reseller/customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        let createNotification = await userService.saveNotificationBulk(notificationArray);

        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.metaData[0]?.firstName,
            redirectId: base_url + "customerDetails/" + createdCustomer._id,
            content: `A New Customer ${data.accountName} has been added and approved by $${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            subject: "New Customer Added"
        }
        // Send Email code here
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ['noreply@getcover.com'], emailData))
        res.send({
            code: constant.successCode,
            message: "Customer created successfully",
            result: createdCustomer

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
        const orderTermCondition = data.termCondition != null ? data.termCondition : {}
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

        let currentYear = new Date().getFullYear();
        let currentYearWithoutHypen = new Date().getFullYear();
        console.log(currentYear); // Outputs: 2024
        currentYear = "-" + currentYear + "-"

        let count = await orderService.getOrdersCount({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + currentYearWithoutHypen + data.unique_key_number
        data.unique_key = "GC" + currentYear + data.unique_key_number

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
            { termCondition: orderTermCondition },
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
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        //send notification to admin and dealer 

        let adminPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
                    ]
                }
            }
        }
        let dealerPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        { metaId: checkOrder.dealerId },
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
                        { metaId: checkOrder.resellerId }
                    ]
                }
            },
        }

        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminPendingQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerPendingQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerPendingQuery, { email: 1 })
        let IDs = adminUsers.map(user => user._id)
        let IDs1 = dealerUsers.map(user => user._id)
        let IDs2 = resellerUsers.map(user => user._id)
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })

        if (data.resellerId) {
            let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: data.resellerId, isPrimary: true } } })
        }
        let notificationArrayData = []
        let notificationData = {
            title: "Draft Order Created",
            description: `A new draft Order # ${checkOrder.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " "+checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'order',
            redirectionId: "editOrder/" + checkOrder._id,
            endPoint: base_url + "editOrder/" + checkOrder._id,
            notificationFor: IDs
        };
        let notificationData1 = {
            title: "Draft Order Created",
            description: `A new draft Order # ${checkOrder.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " "+checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'order',
            redirectionId: "dealer/editOrder/" + checkOrder._id,
            endPoint: base_url + "dealer/editOrder/" + checkOrder._id,
            notificationFor: IDs1
        };
        let notificationData2 = {
            title: "Draft Order Created",
            description: `A new draft Order # ${checkOrder.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " "+checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'order',
            redirectionId: "reseller/editOrder/" + checkOrder._id,
            endPoint: base_url + "reseller/editOrder/" + checkOrder._id,
            notificationFor: IDs2
        };
        notificationArrayData.push(notificationData)
        notificationArrayData.push(notificationData1)
        notificationArrayData.push(notificationData2)

        // Send Email code here
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmail = dealerUsers.map(user => user.email)
        let resellerEmail = resellerUsers.map(user => user.email)

        let settingData = await userService.getSetting({});
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.metaData[0]?.firstName,
            content: `A new Order # ${checkOrder.unique_key} has been created. The order is still in the pending state. To complete the order please click here and fill the data`,
            subject: "New Order",
            redirectId: base_url + "editOrder/" + checkOrder._id,
        }

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
                    minDate = new Date(minDate).setHours(0, 0, 0, 0)
                    let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        pName: priceBook[0]?.pName,
                        minDate: new Date(minDate),
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
                        coverageStartDate1: coverageStartDate1,
                        coverageEndDate: coverageEndDate,
                        coverageEndDate1: coverageEndDate1,
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
                let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: savedResponse.dealerId, isPrimary: true } } })
                let customerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: savedResponse.customerId, isPrimary: true } } })
                let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: savedResponse.resellerId, isPrimary: true } } })
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
                if (req.body.sendNotification) {
                    let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, [], emailData))

                }

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
            let createNotification = await userService.saveNotificationBulk(notificationArrayData);
            if (req.body.sendNotification) {

                let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                emailData.redirectId = base_url + "dealer/editOrder/" + checkOrder._id
                mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
                emailData.redirectId = base_url + "reseller/editOrder/" + checkOrder._id
                mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], emailData))
            }

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

//Edit order detail
exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        let notificationArrayData = []
        let logData = {
            endpoint: "resellerPortal/editOrderDetail",
            body: data,
            userId: req.userId,
            response: {}
        };


        let checkId = await orderService.getOrder({ _id: req.params.orderId });

        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid order ID",
            });
            return;
        }

        if (checkId.status == "Active") {
            res.send({
                code: constant.errorCode,
                message: "Order is already active",
            });
            return;
        }

        if (checkId.status == "Archieved") {
            res.send({
                code: constant.errorCode,
                message: "Order is already archieved",
            });
            return;
        }

        const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })

        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller."
            })
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

        if (data.servicerId != "") {
            if (data.servicerId != checkId.servicerId) {
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
        if (data.customerId != "") {
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
        if (checkId.status == 'Archieved') {
            res.send({
                code: constant.errorCode,
                message: "The order has already archeived!",
            });
            return;
        }
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        data.createdBy = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = req.userId;
        data.customerId = data.customerId != "" ? data.customerId : null;

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
        if (data.billTo == "Dealer") {
            let checkDealer = await dealerService.getDealerById(
                checkReseller.dealerId
            );
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
            let getReseller = await resellerService.getReseller({ _id: checkReseller._id })
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
                console.log("checking the date+++++++++++++++++++++++", addOneDay2)
                addOneDay2.setMonth(addOneDay2.getMonth() + getChoosedProducts[A].term)
                addOneDay2.setDate(addOneDay2.getDate() - 1)
                console.log("checking the date+++++++++++++++++++++++", addOneDay2)
                let addOneDay3 = new Date(getChoosedProducts[A].coverageStartDate)
                console.log("checking the date+++++++++++++++++++++++", addOneDay3)
                addOneDay3.setMonth(addOneDay3.getMonth() + getChoosedProducts[A].term)
                addOneDay3.setDate(addOneDay3.getDate() - 1)

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
                let getDealerPriceBookId = await dealerPriceService.getDealerPriceById({ dealerId: checkId.dealerId, priceBook: dealerPriceBookId })
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
        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);


        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let savedResponse = await orderService.updateOrder(
                { _id: req.params.orderId },
                { status: "Active" },
                { new: true }
            );
            let contractArray = [];
            var pricebookDetail = [];
            let dealerBookDetail = [];

            let currentYear = new Date().getFullYear();
            let currentYearWithoutHypen = new Date().getFullYear();
            console.log(currentYear); // Outputs: 2024
            currentYear = "-" + currentYear + "-"

            let count1 = await contractService.getContractsCountNew({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });

            // let count1 = await contractService.getContractsCountNew();
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let checkLength = savedResponse.productsArray.length - 1
            await savedResponse.productsArray.map(async (product, index) => {
                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: product.priceBookId })
                const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
                let headerLength;
                const bucketReadUrl = { Bucket: process.env.bucket_name, Key: product.orderFile.fileName };
                // Await the getObjectFromS3 function to complete
                const result = await getObjectFromS3(bucketReadUrl);
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
                //dealer Price Book
                let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: checkOrder.dealerId };

                let dealerPriceBook = await dealerPriceService.getDealerPriceById(
                    dealerQuery,
                    projection
                );

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
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails[0]?.brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails[0]._id
                pricebookDetail.push(pricebookDetailObject)
                dealerBookDetail.push(dealerPriceBookObject)

                headerLength = result.headers
                if (headerLength.length !== 8) {
                    res.send({
                        code: constant.errorCode,
                        message: "Invalid file format detected. The sheet should contain exactly four columns."
                    })
                    return
                }

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
                totalDataComing.forEach((data, index) => {
                    let unique_key_number1 = increamentNumber
                    let unique_key_search1 = "OC" + currentYearWithoutHypen + unique_key_number1
                    let unique_key1 = "OC" + currentYear + unique_key_number1
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
                        return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));

                    }
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
                    let contractObject = {
                        orderId: savedResponse._id,
                        orderProductId: orderProductId,
                        productName: priceBook[0].name,
                        pName: priceBook[0]?.pName,
                        minDate: new Date(minDate),
                        manufacture: data.brand,
                        model: data.model,
                        partsWarranty: partsWarrantyDate1,
                        labourWarranty: labourWarrantyDate1,
                        serviceCoverageType: serviceCoverage,
                        coverageType: req.body.coverageType,
                        serial: data.serial,
                        dealerSku: dealerPriceBook.dealerSku,
                        purchaseDate: new Date(data.purchaseDate),
                        orderUniqueKey: savedResponse.unique_key,
                        venderOrder: savedResponse.venderOrder,
                        coverageStartDate: coverageStartDate,
                        coverageStartDate1: coverageStartDate1,
                        coverageEndDate: coverageEndDate,
                        coverageEndDate1: coverageEndDate1,
                        status: claimStatus,
                        eligibilty: eligibilty,
                        productValue: data.retailValue,
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
                    increamentNumber++;
                    contractArray.push(contractObject);
                });
                let createContract = await contractService.createBulkContracts(contractArray);
                if (!createContract[0]) {
                    if (!saveContracts) {
                        logData.response = {
                            code: constant.errorCode,
                            message: "unable to create contracts",
                        };
                        await LOG(logData).save();
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
                }
                if (createContract) {
                    //Save Logs create order
                    logData.response = {
                        code: constant.successCode,
                        message: "Success",
                    };
                    await LOG(logData).save();
                    //send notification to dealer,reseller,admin,customer
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
                                    { metaId: checkOrder.resellerId },
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
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: savedResponse.dealerId, isPrimary: true } } })
                    let createNotification = await userService.saveNotificationBulk(notificationArrayData);
                    // Send Email code here
                    if (!checkOrder?.termCondition) {
                        let notificationEmails = adminUsers.map(user => user.email)
                        let dealerEmail = dealerUsers.map(user => user.email)
                        let resellerEmail = resellerUsers.map(user => user.email)
                        let custmerEmail = customerUsers.map(user => user.email)
                        let emailData = {
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            websiteSetting: settingData[0],
                            senderName: dealerPrimary.metaData[0]?.firstName,
                            content: `Congratulations, your order # ${savedResponse.unique_key} has been created in our system. Please login to the system and view your order details. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                            subject: "Process Order",
                            redirectId: base_url + "orderDetails/" + savedResponse._id,
                        }
                        if (req.body.sendNotification) {

                            let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "dealer/orderDetails/" + savedResponse._id
                            mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "reseller/orderDetails/" + savedResponse._id
                            mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "customer/orderDetails/" + savedResponse._id
                            mailing = sgMail.send(emailConstant.sendEmailTemplate(custmerEmail, ["noreply@getcover.com"], emailData))
                        }
                    }



                    if (index == checkLength) {

                        let reportingData = {
                            orderId: savedResponse._id,
                            products: pricebookDetail,
                            orderAmount: data.orderAmount,
                            dealerId: req.userId,
                            // dealerPriceBook: dealerBookDetail
                        }

                        await supportingFunction.reportingData(reportingData)
                    }

                    if (checkOrder?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }

                    res.send({
                        code: constant.successCode,
                        message: "Success",
                    });
                }

            })
        } else {
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
                            { metaId: checkOrder.resellerId }
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
            let notificationData = {
                title: "Draft Order Updated Successfully",
                description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                contentId: checkOrder._id,
                flag: 'order',
                redirectionId: "editOrder/" + savedResponse._id,
                endPoint: base_url + "editOrder/" + savedResponse._id,
                notificationFor: IDs
            };
            let notificationData1 = {
                title: "Draft Order Updated Successfully",
                description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                contentId: checkOrder._id,
                flag: 'order',
                redirectionId: "dealer/editOrder/" + savedResponse._id,
                endPoint: base_url + "dealer/editOrder/" + savedResponse._id,
                notificationFor: IDs1
            };
            let notificationData2 = {
                title: "Draft Order Updated Successfully",
                description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                contentId: checkOrder._id,
                flag: 'order',
                redirectionId: "reseller/editOrder/" + savedResponse._id,
                endPoint: base_url + "reseller/editOrder/" + savedResponse._id,
                notificationFor: IDs2
            };
            notificationArrayData.push(notificationData)
            notificationArrayData.push(notificationData1)
            notificationArrayData.push(notificationData2)
            let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })

            let createNotification = await userService.saveNotificationBulk(notificationArrayData);

            // Send Email code here
            let notificationEmails = adminUsers.map(user => user.email)
            let dealerEmail = dealerUsers.map(user => user.email)
            let resellerEmail = resellerUsers.map(user => user.email)
            let settingData = await userService.getSetting({});

            let emailData = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName: dealerPrimary.metaData[0]?.firstName,
                content: "Your order " + checkOrder.unique_key + " has been updated in our system. The order is still pending, as there is some data missing.Please update the data using the link here",
                subject: "Order Updated",
                redirectId: base_url + "editOrder/" + checkOrder._id,
            }
            let dealerEmailContent = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName: dealerPrimary.metaData[0]?.firstName,
                content: "Your order " + checkOrder.unique_key + " has been updated in our system. The order is still pending, as there is some data missing.Please update the data using the link here",
                subject: "Order Updated",
                redirectId: base_url + "dealer/editOrder/" + checkOrder._id,
            }
            let resellerEmailContent = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName: dealerPrimary.metaData[0]?.firstName,
                content: "Your order " + checkOrder.unique_key + " has been updated in our system. The order is still pending, as there is some data missing.Please update the data using the link here",
                subject: "Order Updated",
                redirectId: base_url + "reseller/editOrder/" + checkOrder._id,
            }
            if (req.body.sendNotification) {
                let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmail, ["noreply@getcover.com"], dealerEmailContent))
                mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ["noreply@getcover.com"], resellerEmailContent))
            }
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
        res.send({
            code: constant.errorCode,
            message: err.message,
        });
    }
};


//edit order details
// exports.editOrderDetail = async (req, res) => {
//     try {
//         let data = req.body;

//         let logData = {
//             endpoint: "resellerPortal/editOrderDetail",
//             body: data,
//             userId: req.userId,
//             response: {}
//         };

//         const checkReseller = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })

//         if (!checkReseller) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Invalid Reseller."
//             })
//             return;
//         }

//         data.venderOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');

//         let checkId = await orderService.getOrder({ _id: req.params.orderId });
//         if (!checkId) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Invalid order ID",
//             });
//             return;
//         }

//         let checkDealer = await dealerService.getDealerById(
//             checkReseller.dealerId
//         );

//         if (!checkDealer) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Dealer not found",
//             });
//             return;
//         }
//         if (!checkDealer.accountStatus) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Order can not be process, due to the dealer is inactive",
//             });
//             return;
//         }
//         if (data.servicerId != "") {
//             if (data.servicerId != '' && data.servicerId != checkId.servicerId) {
//                 let query = {
//                     $or: [
//                         { _id: data.servicerId },
//                         { resellerId: data.servicerId },
//                         { dealerId: data.servicerId },
//                     ],
//                 };
//                 let checkServicer = await providerService.getServiceProviderById(query);
//                 if (!checkServicer) {
//                     res.send({
//                         code: constant.errorCode,
//                         message: "Servicer not found",
//                     });
//                     return;
//                 }
//             }
//         }
//         if (data.customerId != "" || data.customerId != null) {
//             if (data.customerId != checkId.customerId) {
//                 let query = { _id: data.customerId };
//                 let checkCustomer = await customerService.getCustomerById(query);
//                 if (!checkCustomer) {
//                     res.send({
//                         code: constant.errorCode,
//                         message: "Customer not found",
//                     });
//                     return;
//                 }
//             }
//         }
//         if (checkId.status == "Active") {
//             res.send({
//                 code: constant.errorCode,
//                 message: "The order has already  active",
//             });
//             return;
//         }
//         if (checkId.status == "Archieved") {
//             res.send({
//                 code: constant.errorCode,
//                 message: "The order has already archeived",
//             });
//             return;
//         }
//         if (data.billTo == "Dealer") {
//             let getUser = await userService.getSingleUserByEmail({ metaId: checkDealer._id, isPrimary: true })
//             data.billDetail = {
//                 billTo: "Dealer",
//                 detail: {
//                     name: checkDealer.name,
//                     email: getUser.email,
//                     phoneNumber: getUser.phoneNumber,
//                     address: checkDealer.street + ' , ' + checkDealer.city + ' , ' + checkDealer.country + ' , ' + checkDealer.zip

//                 }
//             }
//         }
//         if (data.billTo == "Reseller") {
//             let getReseller = await resellerService.getReseller({ _id: checkReseller._id })
//             let getUser = await userService.getSingleUserByEmail({ metaId: getReseller._id, isPrimary: true })
//             data.billDetail = {
//                 billTo: "Reseller",
//                 detail: {
//                     name: getReseller.name,
//                     email: getUser.email,
//                     phoneNumber: getUser.phoneNumber,
//                     address: getReseller.street + ' , ' + getReseller.city + ' , ' + getReseller.country + ' , ' + getReseller.zip

//                 }
//             }
//         }
//         if (data.billTo == "Custom") {
//             data.billDetail = {
//                 billTo: "Custom",
//                 detail: {
//                     name: data.name,
//                     email: data.email,
//                     phoneNumber: data.phoneNumber,
//                     address: data.address

//                 }
//             }
//         }
//         data.createdBy = req.userId;
//         data.servicerId = data.servicerId != "" ? data.servicerId : null;
//         data.resellerId = req.userId;
//         data.customerId = data.customerId != "" ? data.customerId : null;

//         if (checkId.paymentStatus == "Paid" && data.paymentStatus == "PartlyPaid") {
//             checkId.paidAmount = 0
//         }
//         if (data.paymentStatus == "Paid") {
//             data.paidAmount = checkId.orderAmount
//             data.dueAmount = 0
//         }
//         data.paidAmount = Number(data.paidAmount)
//         data.dueAmount = Number(checkId.orderAmount) - Number(data.paidAmount)
//         if (Number(data.paidAmount) > Number(checkId.orderAmount)) {
//             res.send({
//                 code: constant.error,
//                 message: "Not a valid paying amount"
//             })
//             return;
//         };

//         if (Number(data.paidAmount) == Number(checkId.orderAmount)) {
//             data.paymentStatus = "Paid"
//         }

//         if (req.files) {
//             const uploadedFiles = req.files.map((file) => ({
//                 fileName: file.filename,
//                 originalName: file.originalname,
//                 filePath: file.path,
//             }));

//             const filteredProducts = data.productsArray.filter(
//                 (product) => product.orderFile.fileName !== ""
//             );
//             const filteredProducts2 = data.productsArray.filter(
//                 (product) => product.file === ""
//             );


//             const productsWithOrderFiles = filteredProducts.map((product, index) => {
//                 const file = uploadedFiles[index];

//                 // Check if 'file' is not null
//                 if (file && file.filePath) {
//                     return {
//                         ...product,
//                         file: file.filePath,
//                         orderFile: {
//                             fileName: file.fileName,
//                             originalName: file.originalName,
//                         },
//                     };
//                 } else {
//                     // If 'file' is null, return the original product without modifications
//                     return product;
//                 }
//             });

//             const finalOutput = [...filteredProducts2, ...productsWithOrderFiles];
//             data.productsArray = finalOutput;
//         }

//         if (checkId.paymentStatus != "Unpaid") {
//             if (Number(data.orderAmount) > Number(checkId.orderAmount)) {
//                 data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
//                 data.paymentStatus = "PartlyPaid"
//             }
//             if (Number(data.orderAmount) < Number(checkId.orderAmount)) {
//                 let checkDue = Number(data.orderAmount) - Number(checkId.paidAmount)
//                 if (checkDue <= 0) {
//                     data.dueAmount = 0
//                     data.paymentStatus = "Paid"
//                 } else {
//                     data.dueAmount = Number(data.orderAmount) - Number(checkId.paidAmount)
//                     data.paymentStatus = "PartlyPaid"
//                 }

//             }
//         }

//         let savedResponse = await orderService.updateOrder(
//             { _id: req.params.orderId },
//             data,
//             { new: true }
//         );
//         var orderServiceCoverageType = savedResponse.serviceCoverageType
//         if (!savedResponse) {
//             logData.response = {
//                 code: constant.errorCode,
//                 message: "unable to update order",
//             };
//             await LOG(logData).save();
//             res.send({
//                 code: constant.errorCode,
//                 message: "unable to create order",
//             });
//             return;
//         }

//         // check to processed order 

//         let returnField = [];

//         let checkOrder = await orderService.getOrder(
//             { _id: req.params.orderId },
//         );
//         if (!checkOrder) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Order not found!",
//             });
//             return;
//         }

//         let resultArray = checkOrder.productsArray.map(
//             (item) => item.coverageStartDate === null
//         );
//         let isEmptyOrderFile = checkOrder.productsArray
//             .map(
//                 (item) =>
//                     item.orderFile.fileName === ""
//             )
//         // .some(Boolean);
//         const obj = {
//             customerId: checkOrder.customerId ? true : false,
//             paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
//             coverageStartDate: resultArray.includes(true) ? false : true,
//             fileName: isEmptyOrderFile.includes(true) ? false : true,
//         };

//         returnField.push(obj);

//         //send notification to dealer,reseller,admin,customer
//         let IDs = await supportingFunction.getUserIds()
//         let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: checkOrder.dealerId, isPrimary: true })
//         IDs.push(dealerPrimary._id)
//         let notificationData = {
//             title: "Order update",
//             description: "The order " + checkOrder.unique_key + " has been updated",
//             userId: req.teammateId,
//             contentId: checkOrder._id,
//             flag: 'order',
//             notificationFor: IDs
//         };
//         let createNotification = await userService.createNotification(notificationData);

//         // Send Email code here
//         let notificationEmails = await supportingFunction.getUserEmails();
//         let settingData = await userService.getSetting({});

//         let emailData = {
//             darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
//             lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
//             address: settingData[0]?.address,
//             websiteSetting: settingData[0],
//             senderName: dealerPrimary.firstName,
//             content: "The  order " + checkOrder.unique_key + " has been updated",
//             subject: "Order Updated"
//         }

//         let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
//         if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
//             let savedResponse = await orderService.updateOrder(
//                 { _id: req.params.orderId },
//                 { status: "Active" },
//                 { new: true }
//             );
//             let contractArray = [];
//             var pricebookDetail = [];
//             let dealerBookDetail = [];
//             let count1 = await contractService.getContractsCountNew();
//             var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
//             let checkLength = savedResponse.productsArray.length - 1
//             await savedResponse.productsArray.map(async (product, index) => {
//                 let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: product.priceBookId })
//                 const pathFile = process.env.LOCAL_FILE_PATH + '/' + product.orderFile.fileName
//                 let headerLength;
//                 const bucketReadUrl = { Bucket: process.env.bucket_name, Key: product.orderFile.fileName };
//                 // Await the getObjectFromS3 function to complete
//                 const result = await getObjectFromS3(bucketReadUrl);
//                 let priceBookId = product.priceBookId;
//                 let coverageStartDate = product.coverageStartDate;
//                 let coverageEndDate = product.coverageEndDate;
//                 let orderProductId = product._id;
//                 let query = { _id: new mongoose.Types.ObjectId(priceBookId) };
//                 let projection = { isDeleted: 0 };
//                 let priceBook = await priceBookService.getPriceBookById(
//                     query,
//                     projection
//                 );
//                 //dealer Price Book
//                 let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: checkOrder.dealerId };

//                 let dealerPriceBook = await dealerPriceService.getDealerPriceById(
//                     dealerQuery,
//                     projection
//                 );

//                 let pricebookDetailObject = {}
//                 let dealerPriceBookObject = {}

//                 pricebookDetailObject.frontingFee = product?.priceBookDetails.frontingFee
//                 pricebookDetailObject.reserveFutureFee = product?.priceBookDetails.reserveFutureFee
//                 pricebookDetailObject.reinsuranceFee = product?.priceBookDetails.reinsuranceFee
//                 pricebookDetailObject._id = product?.priceBookDetails._id
//                 pricebookDetailObject.name = product?.priceBookDetails.name
//                 pricebookDetailObject.categoryId = product?.priceBookDetails.category
//                 pricebookDetailObject.term = product?.priceBookDetails.term
//                 pricebookDetailObject.adminFee = product?.priceBookDetails.adminFee
//                 pricebookDetailObject.price = product.price
//                 pricebookDetailObject.noOfProducts = product.checkNumberProducts

//                 pricebookDetailObject.retailPrice = product.unitPrice
//                 pricebookDetailObject.brokerFee = product.dealerPriceBookDetails.brokerFee
//                 pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails._id
//                 pricebookDetail.push(pricebookDetailObject)
//                 dealerBookDetail.push(dealerPriceBookObject)

//                 headerLength = result.headers
//                 if (headerLength.length !== 8) {
//                     res.send({
//                         code: constant.errorCode,
//                         message: "Invalid file format detected. The sheet should contain exactly four columns."
//                     })
//                     return
//                 }

//                 const totalDataComing1 = result.data

//                 const totalDataComing = totalDataComing1.map((item) => {
//                     const keys = Object.keys(item);
//                     return {
//                         brand: item[keys[0]],
//                         model: item[keys[1]],
//                         serial: item[keys[2]],
//                         condition: item[keys[3]],
//                         retailValue: item[keys[4]],
//                         partsWarranty: item[keys[5]],
//                         labourWarranty: item[keys[6]],
//                         purchaseDate: item[keys[7]],
//                     };
//                 });
//                 totalDataComing.forEach((data, index) => {
//                     let unique_key_number1 = increamentNumber
//                     let unique_key_search1 = "OC" + "2024" + unique_key_number1
//                     let unique_key1 = "OC-" + "2024-" + unique_key_number1
//                     let claimStatus = new Date(product.coverageStartDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? "Waiting" : "Active"
//                     claimStatus = new Date(product.coverageEndDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? "Expired" : claimStatus
//                     // -------------------------------------------------  copy from -----------------------------------------//
//                     let dateCheck = new Date(product.coverageStartDate)
//                     let adhDays = Number(product.adh ? product.adh : 0)
//                     let partWarrantyMonth = Number(data.partsWarranty ? data.partsWarranty : 0)
//                     let labourWarrantyMonth = Number(data.labourWarranty ? data.labourWarranty : 0)
//                     dateCheck = new Date(dateCheck.setDate(dateCheck.getDate() + adhDays))
//                     let p_date = new Date(data.purchaseDate)
//                     let p_date1 = new Date(data.purchaseDate)
//                     let l_date = new Date(data.purchaseDate)
//                     let l_date1 = new Date(data.purchaseDate)
//                     let purchaseMonth = p_date.getMonth();
//                     let monthsPart = partWarrantyMonth;
//                     let newPartMonth = purchaseMonth + monthsPart;

//                     let monthsLabour = labourWarrantyMonth;
//                     let newLabourMonth = purchaseMonth + monthsLabour;

//                     let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
//                     let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
//                     let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
//                     let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
//                     //---------------------------------------- till here ----------------------------------------------
//                     function findMinDate(d1, d2, d3) {
//                         return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));

//                     }
//                     // Find the minimum date
//                     let minDate;

//                     let adhDaysArray = product.adhDays

//                     adhDaysArray.sort((a, b) => a.waitingDays - b.waitingDays);

//                     const futureDate = new Date(product.coverageStartDate)

//                     let minDate1 = futureDate.setDate(futureDate.getDate() + adhDaysArray[0].waitingDays);
//                     if (!product.isManufacturerWarranty) {
//                         let minDate2
//                         console.log("savedresponse+++++++++++++++++++++++++++++++++++++++++++++00000000000++++++++++++++", orderServiceCoverageType, savedResponse.serviceCoverageType)
//                         if (orderServiceCoverageType.serviceCoverageType == "Parts") {
//                             minDate2 = partsWarrantyDate1
//                         } else if (orderServiceCoverageType.serviceCoverageType == "Labor" || orderServiceCoverageType.serviceCoverageType == "Labour") {
//                             minDate2 = labourWarrantyDate1
//                         } else {
//                             if (partsWarrantyDate1 > labourWarrantyDate1) {
//                                 minDate2 = labourWarrantyDate1
//                             } else {
//                                 minDate2 = partsWarrantyDate1
//                             }
//                         }
//                         if (minDate1 > minDate2) {
//                             minDate = minDate1
//                         }
//                         if (minDate1 < minDate2) {
//                             minDate = minDate2
//                         }

//                     } else {
//                         minDate = minDate1

//                     }
//                     let eligibilty = claimStatus == "Active" ? new Date(minDate) < new Date() ? true : false : false
//                     let contractObject = {
//                         orderId: savedResponse._id,
//                         orderProductId: orderProductId,
//                         productName: priceBook[0].name,
//                         pName: priceBook[0]?.pName,
//                         minDate: minDate,
//                         manufacture: data.brand,
//                         model: data.model,
//                         partsWarranty: partsWarrantyDate1,
//                         labourWarranty: labourWarrantyDate1,
//                         serviceCoverageType: serviceCoverage,
//                         coverageType: req.body.coverageType,
//                         serial: data.serial,
//                         dealerSku: dealerPriceBook.dealerSku,
//                         purchaseDate: new Date(data.purchaseDate),
//                         orderUniqueKey: savedResponse.unique_key,
//                         venderOrder: savedResponse.venderOrder,
//                         coverageStartDate: coverageStartDate,
//                         coverageEndDate: coverageEndDate,
//                         status: claimStatus,
//                         eligibilty: eligibilty,
//                         productValue: data.retailValue,
//                         condition: data.condition,
//                         productValue: data.retailValue,
//                         unique_key: unique_key1,
//                         unique_key_search: unique_key_search1,
//                         unique_key_number: unique_key_number1,
//                     };
//                     increamentNumber++;
//                     contractArray.push(contractObject);
//                 });
//                 let createContract = await contractService.createBulkContracts(contractArray);
//                 if (!createContract[0]) {
//                     if (!saveContracts) {
//                         logData.response = {
//                             code: constant.errorCode,
//                             message: "unable to create contracts",
//                         };
//                         await LOG(logData).save();
//                         let savedResponse = await orderService.updateOrder(
//                             { _id: checkOrder._id },
//                             { status: "Pending" },
//                             { new: true }
//                         );
//                         res.send({
//                             code: constant.errorCode,
//                             message: "Something went wrong in creating the contract",
//                         });
//                         return
//                     }
//                 }
//                 if (createContract) {
//                     //Save Logs create order
//                     logData.response = {
//                         code: constant.successCode,
//                         message: "Success",
//                     };
//                     await LOG(logData).save();
//                     //send notification to dealer,reseller,admin,customer
//                     let IDs = await supportingFunction.getUserIds()
//                     let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.dealerId, isPrimary: true })
//                     let customerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.customerId, isPrimary: true })
//                     let resellerPrimary = await supportingFunction.getPrimaryUser({ metaId: savedResponse.resellerId, isPrimary: true })
//                     if (resellerPrimary) {
//                         IDs.push(resellerPrimary._id)
//                     }
//                     IDs.push(dealerPrimary._id, customerPrimary._id)
//                     let notificationData1 = {
//                         title: "Order update and processed",
//                         description: "The order has been update and processed",
//                         userId: req.teammateId,
//                         contentId: savedResponse._id,
//                         flag: 'order',
//                         notificationFor: IDs
//                     };
//                     let createNotification = await userService.createNotification(notificationData1);
//                     // Send Email code here
//                     let notificationEmails = await supportingFunction.getUserEmails();
//                     let emailData = {
//                         darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
//                         lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
//                         address: settingData[0]?.address,
//                         websiteSetting: settingData[0],
//                         senderName: dealerPrimary.firstName,
//                         content: "The  order " + savedResponse.unique_key + " has been updated and processed",
//                         subject: "Process Order"
//                     }
//                     let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
//                     //Email to Reseller
//                     emailData = {
//                         darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
//                         lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
//                         address: settingData[0]?.address,
//                         websiteSetting: settingData[0],
//                         senderName: resellerPrimary?.firstName,
//                         content: "The  order " + savedResponse.unique_key + " has been updated and processed",
//                         subject: "Process Order"
//                     }
//                     mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
//                     // Customer Email here with T and C
//                     //generate T anc C

//                     if (index == checkLength) {

//                         let reportingData = {
//                             orderId: savedResponse._id,
//                             products: pricebookDetail,
//                             orderAmount: data.orderAmount,
//                             dealerId: req.userId,
//                             // dealerPriceBook: dealerBookDetail
//                         }

//                         await supportingFunction.reportingData(reportingData)
//                     }

//                     if (checkDealer?.termCondition) {
//                         const tcResponse = await generateTC(savedResponse);
//                     }

//                     res.send({
//                         code: constant.successCode,
//                         message: "Success",
//                     });
//                 }

//             })
//         } else {
//             logData.response = {
//                 code: constant.successCode,
//                 message: "Success",
//             };
//             await LOG(logData).save();
//             res.send({
//                 code: constant.successCode,
//                 message: "Success",
//             });
//         }
//     } catch (err) {
//         //Save Logs for create price book
//         let logData = {
//             userId: req.userId,
//             endpoint: "resellerPortal/editOrderDetail catch",
//             body: req.body ? req.body : { type: "Catch error" },
//             response: {
//                 code: constant.errorCode,
//                 message: err.message
//             }
//         }
//         await LOG(logData).save()
//         res.send({
//             code: constant.errorCode,
//             message: err.message,
//         });
//     }
// };

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


        let statusCheck;
        if (!checkReseller.status) {
            statusCheck = false
        } else {
            statusCheck = data.status
        }
        let metaData = {
            email: data.email,
            metaData: [
                {
                    metaId: checkReseller._id,
                    status: statusCheck,
                    roleId: "65bb94b4b68e5a4a62a0b563",
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phoneNumber: data.phoneNumber,
                    position: data.position,
                    isPrimary: false,
                    dialCode: data.dialCode ? data.dialCode : "+1"

                }
            ]

        }
        let saveData = await userService.createUser(metaData)
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



//Get Sale Reporting data
exports.getSaleReportingDropdown = async (req, res) => {
    try {
        let flag = req.params.flag
        let response;
        let dealerId = req.userId;
        if (req.role == "Reseller") {
            const checkReseller = await resellerService.getReseller({ _id: req.userId })
            dealerId = checkReseller.dealerId
        }
        let catQuery = [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(dealerId)
                }
            },
            {
                $lookup: {
                    from: "dealerpricebooks",
                    localField: "_id",
                    foreignField: "dealerId",
                    as: "dealerPricebookData", // Keep dealerPricebookData as an array
                }
            },
            {
                $lookup: {
                    from: "pricebooks",
                    localField: "dealerPricebookData.priceBook", // Array of priceBook IDs
                    foreignField: "_id",
                    as: "pricebookData" // Keep pricebookData as an array
                },

            },
            {
                $lookup: {
                    from: "pricecategories",
                    localField: "pricebookData.category", // Array of priceBook IDs
                    foreignField: "_id",
                    as: "categories" // Keep pricebookData as an array
                },

            },
            {
                $project: {
                    categories: {
                        $map: {
                            input: "$categories", // Input from categoryData
                            as: "cat",             // Alias for each element
                            in: {
                                categoryName: "$$cat.name",  // Use category name
                                categoryId: "$$cat._id",    // Use category _id
                                priceBooks: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$pricebookData", // Filter pricebooks
                                                as: "pb",               // Alias for pricebook
                                                cond: { $eq: ["$$pb.category", "$$cat._id"] }  // Match pricebooks for the current category
                                            }
                                        },
                                        as: "pb", // Alias for each pricebook
                                        in: {
                                            priceBookId: "$$pb._id",
                                            priceBookName: {
                                                $arrayElemAt: [
                                                    {
                                                        $map: {
                                                            input: {
                                                                $filter: {
                                                                    input: "$dealerPricebookData", // Filter dealer pricebooks
                                                                    as: "dpb",                    // Alias for dealer pricebook
                                                                    cond: { $eq: ["$$dpb.priceBook", "$$pb._id"] } // Match dealer pricebooks with the current pricebook
                                                                }
                                                            },
                                                            as: "dpb", // Alias for each dealer pricebook
                                                            in: "$$dpb.dealerSku" // Extract dealerSku field
                                                        }
                                                    },
                                                    0 // Extract the first dealerSku
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]

        response = await dealerService.getDealerAndClaims(catQuery)


        res.send({
            code: constant.successCode,
            result: response
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.getClaimReportingDropdown = async (req, res) => {
    try {
        let flag = req.params.flag
        let response;
        let dealerId = req.userId;
        if (req.role == "Reseller") {
            const checkReseller = await resellerService.getReseller({ _id: req.userId })
            dealerId = checkReseller.dealerId
        }
        if (flag == "servicer") {
            if (req.role == "Reseller") {
                let resellerQuery = [
                    {
                        $match:
                        {
                            _id: new mongoose.Types.ObjectId(req.userId)
                        },
                    },
                    {
                        $lookup: {
                            from: "serviceproviders",
                            let: {
                                id: "$_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $eq: [{ $toObjectId: "$resellerId" }, "$$id"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "resellerAsServicer"
                        }
                    },
                    {
                        $lookup: {
                            from: "dealers",
                            localField: "dealerId",
                            foreignField: "_id",
                            as: "dealerData" // Keep dealerPricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "serviceproviders",
                            let: {
                                resellerIds: "$dealerData._id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $isArray: "$$resellerIds" }, // Ensure it's an array
                                                { $in: [{ $toObjectId: "$dealerId" }, "$$resellerIds"] } // Convert dealerId to ObjectId and match
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "dealerAsServicer"
                        }
                    },
                    {
                        $lookup: {
                            from: "servicer_dealer_relations",
                            localField: "dealerData._id",
                            foreignField: "dealerId",
                            as: "dealerServicer" // Keep dealerPricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "serviceproviders",
                            localField: "dealerServicer.servicerId",
                            foreignField: "_id",
                            as: "servicer" // Keep dealerPricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "dealerpricebooks",
                            localField: "dealerData._id",
                            foreignField: "dealerId",
                            as: "dealerPricebookData" // Keep dealerPricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "pricebooks",
                            localField: "dealerPricebookData.priceBook", // Array of priceBook IDs
                            foreignField: "_id",
                            as: "pricebookData" // Keep pricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "pricecategories",
                            localField: "pricebookData.category", // Array of category IDs
                            foreignField: "_id",
                            as: "categoryData" // Keep categoryData as an array
                        }
                    },
                    {
                        $project: {
                            servicer: {
                                $map: {
                                    input: { $concatArrays: ["$servicer", "$dealerAsServicer", "$resellerAsServicer"] }, // Merge servicer and dealerAsServicer arrays
                                    as: "servicerItem",
                                    in: {
                                        _id: "$$servicerItem._id", // Include only _id
                                        name: "$$servicerItem.name" // Include only name
                                    }
                                }
                            },
                            categories: {
                                $map: {
                                    input: "$categoryData", // Input from categoryData
                                    as: "cat",             // Alias for each element
                                    in: {
                                        categoryName: "$$cat.name",  // Use category name
                                        categoryId: "$$cat._id",    // Use category _id
                                        priceBooks: {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: "$pricebookData", // Filter pricebooks
                                                        as: "pb",               // Alias for pricebook
                                                        cond: { $eq: ["$$pb.category", "$$cat._id"] }  // Match pricebooks for the current category
                                                    }
                                                },
                                                as: "pb", // Alias for each pricebook
                                                in: {
                                                    priceBookId: "$$pb._id",
                                                    priceBookName: {
                                                        $arrayElemAt: [
                                                            {
                                                                $map: {
                                                                    input: {
                                                                        $filter: {
                                                                            input: "$dealerPricebookData", // Filter dealer pricebooks
                                                                            as: "dpb",                    // Alias for dealer pricebook
                                                                            cond: { $eq: ["$$dpb.priceBook", "$$pb._id"] } // Match dealer pricebooks with the current pricebook
                                                                        }
                                                                    },
                                                                    as: "dpb", // Alias for each dealer pricebook
                                                                    in: "$$dpb.dealerSku" // Extract dealerSku field
                                                                }
                                                            },
                                                            0 // Extract the first dealerSku
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]

                response = await resellerService.getResellerByAggregate(resellerQuery)
            }

        }

        if (flag == "category") {
            let catQuery = [
                {
                    $match: {
                        _id: new mongoose.Types.ObjectId(dealerId)
                    }
                },
                {
                    $lookup: {
                        from: "dealerpricebooks",
                        localField: "_id",
                        foreignField: "dealerId",
                        as: "dealerPricebookData", // Keep dealerPricebookData as an array
                    }
                },
                {
                    $lookup: {
                        from: "pricebooks",
                        localField: "dealerPricebookData.priceBook", // Array of priceBook IDs
                        foreignField: "_id",
                        as: "pricebookData" // Keep pricebookData as an array
                    },

                },
                {
                    $lookup: {
                        from: "pricecategories",
                        localField: "pricebookData.category", // Array of priceBook IDs
                        foreignField: "_id",
                        as: "categories" // Keep pricebookData as an array
                    },

                },
                {
                    $project: {
                        categories: {
                            $map: {
                                input: "$categories", // Input from categoryData
                                as: "cat",             // Alias for each element
                                in: {
                                    categoryName: "$$cat.name",  // Use category name
                                    categoryId: "$$cat._id",    // Use category _id
                                    priceBooks: {
                                        $map: {
                                            input: {
                                                $filter: {
                                                    input: "$pricebookData", // Filter pricebooks
                                                    as: "pb",               // Alias for pricebook
                                                    cond: { $eq: ["$$pb.category", "$$cat._id"] }  // Match pricebooks for the current category
                                                }
                                            },
                                            as: "pb", // Alias for each pricebook
                                            in: {
                                                priceBookId: "$$pb._id",
                                                priceBookName: {
                                                    $arrayElemAt: [
                                                        {
                                                            $map: {
                                                                input: {
                                                                    $filter: {
                                                                        input: "$dealerPricebookData", // Filter dealer pricebooks
                                                                        as: "dpb",                    // Alias for dealer pricebook
                                                                        cond: { $eq: ["$$dpb.priceBook", "$$pb._id"] } // Match dealer pricebooks with the current pricebook
                                                                    }
                                                                },
                                                                as: "dpb", // Alias for each dealer pricebook
                                                                in: "$$dpb.dealerSku" // Extract dealerSku field
                                                            }
                                                        },
                                                        0 // Extract the first dealerSku
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]

            response = await dealerService.getDealerAndClaims(catQuery)
        }

        res.send({
            code: constant.successCode,
            result: response
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};
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
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            return contractService.getContractById({
                orderProductId: item._id
            });

        })
        const contractArray = await Promise.all(contractArrayPromise);

        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: checkOrder?.productsArray[i]?.dealerSku,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract?.dealerSku,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await providerService.getServiceProviderById({
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
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${checkOrder.productsArray[0]?.term / 12} 
                ${checkOrder.productsArray[0]?.term / 12 === 1 ? 'Year' : 'Years'}
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${moment(coverageEndDate).format("MM/DD/YYYY")}</td>
          </tr>
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
            // Send Email code here

            const adminActiveOrderQuery = {
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

            const dealerActiveOrderQuery = {
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

            const resellerActiveOrderQuery = {
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

            const customerActiveOrderQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "orderNotifications.updateOrderActive": true },
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

            let notificationEmails = adminUsers.map(user => user.email)
            let dealerEmails = dealerUsers.map(user => user.email)
            let resellerEmails = resellerUsers.map(user => user.email)
            let customerEmails = customerUsers.map(user => user.email)
            const base_url = `${process.env.SITE_URL}`

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
            emailData.redirectId = base_url + "dealer/orderDetails/" + checkOrder._id
            mailing = sgMail.send(emailConstant.sendTermAndCondition(dealerEmails, ["noreply@getcover.com"], emailData, attachment))
            emailData.redirectId = base_url + "customer/orderDetails/" + checkOrder._id

            mailing = sgMail.send(emailConstant.sendTermAndCondition(customerEmails, ["noreply@getcover.com"], emailData, attachment))
            emailData.redirectId = base_url + "reseller/orderDetails/" + checkOrder._id
            mailing = sgMail.send(emailConstant.sendTermAndCondition(resellerEmails, ["noreply@getcover.com"], emailData, attachment))


        })
        return 1

    }
    catch (err) {
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
                const wb = XLSX.read(data.Body, { type: 'buffer' });
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
