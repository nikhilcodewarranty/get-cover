require('dotenv').config()
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService");
const contractService = require("../../services/Contract/contractService");
const resellerService = require("../../services/Dealer/resellerService")
let claimService = require('../../services/Claim/claimService')
const LOG = require('../../models/User/logs')
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const providerService = require("../../services/Provider/providerService")
const userService = require("../../services/User/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const supportingFunction = require('../../config/supportingFunction')
const randtoken = require('rand-token').generator()
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);


//Create reseller
exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        let getCount = await resellerService.getResellersCount({})
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`

        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
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
        let isAccountCreate = data.status
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
            isAccountCreate: isAccountCreate,
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
        //Send Notification to reseller and admin
        const adminQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "resellerNotifications.resellerAdded": true },
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
                        { "resellerNotifications.resellerAdded": true },
                        { status: true },
                        { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
                    ]
                }
            },
        }
        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        let notificationArray = []
        const dealerId = dealerUsers.map(user => user._id)
        // Create the user
        teamMembers = teamMembers.map(member => ({
            ...member,
            metaData:
                [
                    {
                        firstName: member.firstName,
                        lastName: member.lastName,
                        phoneNumber: member.phoneNumber,
                        metaId: createdReseler._id,
                        roleId: "65bb94b4b68e5a4a62a0b563",
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
        // Primary User Welcoime email
        let notificationEmails = adminUsers.map(user => user.email)
        let mergedEmail;
        let dealerEmails = dealerUsers.map(user => user.email)
        mergedEmail = notificationEmails.concat(dealerEmails)
        //Merge start singleServer
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })

        let notificationData = {
            title: "New Reseller  Added",
            description: `A New Reseller ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} -  ${req.role} on our portal.`,
            userId: req.teammateId,
            redirectionId: "resellerDetails/" + createdReseler._id,
            endPoint: base_url + "resellerDetails/" + createdReseler._id,
            flag: 'reseller',
            notificationFor: IDs
        };
        notificationArray.push(notificationData)

        notificationData = {
            title: "New Reseller  Added",
            description: `A New Reseller ${data.accountName} has been added and approved by  ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - ${req.role} on our portal.`,
            userId: req.teammateId,
            redirectionId: "dealer/resellerDetails/" + createdReseler._id,
            endPoint: base_url + "dealer/resellerDetails/" + createdReseler._id,
            flag: 'reseller',
            notificationFor: dealerId
        };
        notificationArray.push(notificationData)

        let createNotification = await userService.saveNotificationBulk(notificationArray);
        let settingData = await userService.getSetting({});
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.metaData[0]?.firstName,
            content: "We are delighted to inform you that the reseller account for " + createdReseler.name + " has been created.",
            subject: "Reseller Account Created - " + createdReseler.name
        }


        // Send Email code here
        let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
       mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ['noreply@getcover.com'], emailData))

        if (data.status) {
            for (let i = 0; i < saveMembers.length; i++) {
                if (saveMembers[i].metaData[0].status) {
                    let email = saveMembers[i].email
                    let userId = saveMembers[i]._id
                    let resetPasswordCode = randtoken.generate(4, '123456789')
                    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                    constmailing = await sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email,
                        {
                            flag: "created",
                            link: resetLink,
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            subject: "Set Password",
                            title: settingData[0]?.title,
                            address: settingData[0]?.address,
                            role: "Reseller",
                            servicerName: saveMembers[i].metaData[0].firstName + " " + saveMembers[i].metaData[0].lastName
                        }))
                }

            }
        }

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
        //Save Logs create reseller
        let logData = {
            userId: req.userId,
            endpoint: "reseller/createReseller",
            body: data,
            response: {
                code: constant.successCode,
                message: "Reseller created successfully",
                result: createdReseler
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.successCode,
            message: "Reseller created successfully",
            result: data
        })


    } catch (err) {
        //Save Logs create reseller
        let logData = {
            userId: req.userId,
            endpoint: "reseller/createReseller catch",
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

//Get all reseller
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

        const resellerId = resellers.map(obj => obj._id);
        const resellerOrderIds = resellers.map(obj => obj._id);
        const getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: resellerId }, isPrimary: true } } }
                    ]
                }
            },
            {
                $project: {
                    email: 1,
                    'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                    'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                    'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                    'position': { $arrayElemAt: ["$metaData.position", 0] },
                    'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                    'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                    'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                    'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                    'status': { $arrayElemAt: ["$metaData.status", 0] },
                    resetPasswordCode: 1,
                    isResetPassword: 1,
                    approvedStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);
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
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.metaId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.metaId.toString())
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

//Reseller by dealer id
exports.getResellerByDealerId = async (req, res) => {
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action"
        })
        return;
    }
    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { accountStatus: 1 });
    if (!dealers) {
        res.send({
            code: constant.errorCode,
            message: "Dealer not found"
        });
        return;
    };
    let resellerData = await resellerService.getResellers({ dealerId: req.params.dealerId }, { isDeleted: 0 })

    const resellerIds = resellerData.map(reseller => reseller._id)

    const getPrimaryUser = await userService.findUserforCustomer1([
        {
            $match: {
                $and: [
                    { metaData: { $elemMatch: { metaId: { $in: resellerIds }, isPrimary: true } } }
                ]
            }
        },
        {
            $project: {
                email: 1,
                'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                'position': { $arrayElemAt: ["$metaData.position", 0] },
                'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                'status': { $arrayElemAt: ["$metaData.status", 0] },
                resetPasswordCode: 1,
                isResetPassword: 1,
                approvedStatus: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    const result_Array = getPrimaryUser.map(item1 => {
        const matchingItem = resellerData.find(item2 => item2._id.toString() === item1.metaId.toString());

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

//Get reseller by id
exports.getResellerById = async (req, res) => {
    try {

        function isValidObjectId(id) {
            return mongoose.Types.ObjectId.isValid(id);
        }
        if (!isValidObjectId(req.params.resellerId)) {
            res.send({
                code: constant.errorCode,
                message: "Invalid resellerId"
            })
            return
        }

        let checkReseller = await resellerService.getResellers({ _id: req.params.resellerId }, { isDeleted: 0 });

        if (!checkReseller[0]) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found'
            })
            return;
        }
        let checkDealerStatus = await dealerService.getDealerByName({ _id: checkReseller[0].dealerId })

        const resellerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { metaId: { $in: [checkReseller[0]._id] }, isPrimary: true } } }
                    ]
                }
            },
            {
                $project: {
                    email: 1,
                    'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                    'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                    'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                    'position': { $arrayElemAt: ["$metaData.position", 0] },
                    'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                    'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                    'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                    'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                    'status': { $arrayElemAt: ["$metaData.status", 0] },
                    resetPasswordCode: 1,
                    isResetPassword: 1,
                    approvedStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

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
        const claimQuery = { claimFile: 'completed' }

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
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.params.resellerId) },
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

        let valueClaim = await claimService.getClaimWithAggregate(lookupQuery);
        const rejectedQuery = { claimFile: { $ne: "rejected" } }
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
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.params.resellerId) },
                    ]
                },
            },
        ]

        let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim[0]?.totalAmount
        }
        const result_Array = resellerUser.map(user => {
            let matchItem = checkReseller.find(reseller => reseller._id.toString() == user.metaId.toString());
            let order = ordersResult.find(order => order._id.toString() === user.metaId.toString())
            if (matchItem || order) {
                return {
                    ...user,
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

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }


}

//Get reseller users
exports.getResellerUsers = async (req, res) => {
    let data = req.body
    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }

    const users = await userService.findUserforCustomer1([
        {
            $match: {
                $and: [
                    { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                    { metaData: { $elemMatch: { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                    { metaData: { $elemMatch: { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                    { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                    { metaData: { $elemMatch: { metaId: checkReseller._id } } }
                ]
            }
        },
        {
            $project: {
                email: 1,
                'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                'position': { $arrayElemAt: ["$metaData.position", 0] },
                'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                'status': { $arrayElemAt: ["$metaData.status", 0] },
                resetPasswordCode: 1,
                isResetPassword: 1,
                approvedStatus: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);


    res.send({
        code: constant.successCode,
        data: users,
        resellerStatus: checkReseller.status,
        isAccountCreate: checkReseller.isAccountCreate
    });
    return;
}

//Get reseller price books
exports.getResellerPriceBook = async (req, res) => {
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action"
        })
        return;
    }

    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    let dealerSku = req.body.dealerSku ? req.body.dealerSku.replace(/\s+/g, ' ').trim() : ''

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

    const data = req.body
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let projection = { isDeleted: 0, __v: 0 }
    let query

    const coverageType = data.coverageType
    if (data.coverageType == "") {
        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'priceBooks.coverageType': { $elemMatch: { value: { $in: checkDealer.coverageType } } } },
                { 'status': true },
                { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
                {
                    dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                },
                {
                    isDeleted: false
                }
            ]
        }
    }

    else {
        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.coverageType.value': { $all: coverageType } },
                { 'priceBooks.coverageType': { $size: coverageType.length } },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'status': true },
                { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
                {
                    dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                },
                {
                    isDeleted: false
                }
            ]
        }

    }

    // if (checkDealer.coverageType == "Breakdown & Accidental") {
    //     if (data.coverageType == "") {
    //         query = {
    //             $and: [
    //                 { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
    //                 { 'priceBooks.category._id': { $in: catIdsArray } },
    //                 { 'status': true },
    //                 { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
    //                 {
    //                     dealerId: new mongoose.Types.ObjectId(checkDealer._id)
    //                 },
    //                 {
    //                     isDeleted: false
    //                 }
    //             ]
    //         }
    //     } else {
    //         query = {
    //             $and: [
    //                 { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
    //                 { 'priceBooks.category._id': { $in: catIdsArray } },
    //                 { 'status': true },
    //                 { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
    //                 { 'priceBooks.coverageType': data.coverageType },

    //                 {
    //                     dealerId: new mongoose.Types.ObjectId(checkDealer._id)
    //                 },
    //                 {
    //                     isDeleted: false
    //                 }
    //             ]
    //         }
    //     }
    // } else {
    //     if (data.coverageType == "") {
    //         query = {
    //             $and: [
    //                 { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
    //                 { 'priceBooks.category._id': { $in: catIdsArray } },
    //                 { 'priceBooks.coverageType': checkDealer.coverageType },
    //                 { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
    //                 { 'status': true },
    //                 {
    //                     dealerId: new mongoose.Types.ObjectId(checkDealer._id)
    //                 },
    //                 {
    //                     isDeleted: false
    //                 }
    //             ]
    //         }
    //     } else {
    //         query = {
    //             $and: [
    //                 { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
    //                 { 'priceBooks.coverageType': data.coverageType },
    //                 { 'priceBooks.category._id': { $in: catIdsArray } },
    //                 { 'dealerSku': { '$regex': dealerSku, '$options': 'i' } },
    //                 { 'status': true },
    //                 {
    //                     dealerId: new mongoose.Types.ObjectId(checkDealer._id)
    //                 },
    //                 {
    //                     isDeleted: false
    //                 }
    //             ]
    //         }
    //     }

    // }


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
        }
    }

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

//Edit reseller by id
exports.editResellers = async (req, res) => {
    try {
        let data = req.body
        let criteria = { _id: req.params.resellerId }
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        data.oldName = data.oldName.trim().replace(/\s+/g, ' ');
        let option = { new: true }
        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 });
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
        if (!updateReseller) {
            //Save Logs update reseller
            let logData = {
                userId: req.userId,
                endpoint: "/reseller/editResellers",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to update the data"
                }
            }
            await LOG(logData).save()

            res.send({
                code: constant.errorCode,
                message: "Unable to update the data"
            })
            return;
        }
        const servicerMeta = {
            name: data.accountName,
            city: data.city,
            country: data.country,
            street: data.street,
            zip: data.zip
        }
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId }, {});
        const updateServicerMeta = await providerService.updateServiceProvider({ resellerId: req.params.resellerId }, servicerMeta)

        //Notification to dealer,admin,reseller
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        const adminDealerrQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "resellerNotifications.resellerUpdate": true },
                        { status: true },
                        { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
                    ]
                }
            },
        }

        const dealerrQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "resellerNotifications.resellerUpdate": true },
                        { status: true },
                        { metaId: new mongoose.Types.ObjectId(checkReseller.dealerId) }
                    ]
                }
            },
        }

        const reellerQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "resellerNotifications.resellerUpdate": true },
                        { status: true },
                        { metaId: new mongoose.Types.ObjectId(checkReseller._id) }
                    ]
                }
            },
        }

        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerrQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerrQuery, { email: 1 })
        let resellerUsers = await supportingFunction.getNotificationEligibleUser(reellerQuery, { email: 1 })
        let notificationArray = []

        let IDs = adminUsers.map(user => user._id)
        let dealerIds = dealerUsers.map(user => user._id)
        let dealerEmails = dealerUsers.map(user => user.email)
        let resellerId = resellerUsers.map(user => user._id)
        let resellerEmail = resellerUsers.map(user => user.email)

        let notificationData = {
            title: "Reseller Details Updated",
            description: `The details of Reseller ${checkReseller.name} for the Dealer ${checkDealer.name} has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
            userId: req.teammateId,
            redirectionId: "resellerDetails/" + checkReseller._id,
            flag: 'reseller',
            endPoint: base_url + "resellerDetails/" + checkReseller._id,
            notificationFor: IDs
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "Reseller Details Updated",
            description: `The details of Reseller ${checkReseller.name}  has been updated by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
            userId: req.teammateId,
            redirectionId: "dealer/resellerDetails/" + checkReseller._id,
            flag: 'reseller',
            endPoint: base_url + "dealer/resellerDetails/" + checkReseller._id,
            notificationFor: dealerIds
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "Details Updated",
            description: `The details for your account has been changed by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
            userId: req.teammateId,
            redirectionId: "reseller/user",
            flag: 'reseller',
            endPoint: base_url + "reseller/user",
            notificationFor: resellerId
        };
        notificationArray.push(notificationData)
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkReseller.dealerId, isPrimary: true } } })

        let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkReseller._id, isPrimary: true } } })
        let mergedEmail;
        let notificationEmails = adminUsers.map(user => user.email)
        mergedEmail = notificationEmails.concat(resellerEmail, dealerEmails)
        if (data.isServicer) {
            const checkServicer = await providerService.getServiceProviderById({ resellerId: req.params.resellerId })
            if (!checkServicer) {
                const CountServicer = await providerService.getServicerCount();
                let servicerObject = {
                    name: data.accountName,
                    street: data.street,
                    city: data.city,
                    zip: data.zip,
                    resellerId: req.params.resellerId,
                    state: data.state,
                    country: data.country,
                    status: data.status,
                    accountStatus: "Approved",
                    unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                }
                let createData = await providerService.createServiceProvider(servicerObject)
            }

            else {
                const servicerMeta = {
                    name: data.accountName,
                    city: data.city,
                    country: data.country,
                    street: data.street,
                    zip: data.zip
                }
                const updateServicerMeta = await providerService.updateServiceProvider(criteria, servicerMeta)
            }

        }
        let newValue = {
            $set: {
                'metaData.$.status': false,
            }
        }

        let resellerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.resellerId } } }

        if (data.isAccountCreate && checkReseller.status) {
            resellerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.resellerId, isPrimary: true } } }
            newValue = {
                $set: {
                    'metaData.$.status': true,
                }
            }
        }

        const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, { new: true });
        let createNotification = await userService.saveNotificationBulk(notificationArray);
        // Send Email code here
        let settingData = await userService.getSetting({});
        //notificationEmails.push(resellerPrimary.email);
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: `Dear ${checkReseller?.name}`,
            content: "Your details have been updated. To view the details, please login into your account.",
            subject: "Update Info"
        }
        let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
       mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ['noreply@getcover.com'], emailData))
       mailing = await sgMail.send(emailConstant.sendEmailTemplate(resellerEmail, ['noreply@getcover.com'], emailData))


        //Save Logs update reseller
        let logData = {
            userId: req.userId,
            endpoint: "/reseller/editResellers",
            body: data,
            response: {
                code: constant.successCode,
                message: "Success",
                result: updateReseller
            }
        }
        await LOG(logData).save()

        res.send({
            code: constant.successCode,
            message: "Success",
            result: updateReseller
        })

    }
    catch (err) {
        //Save Logs update reseller
        let logData = {
            userId: req.userId,
            endpoint: "/reseller/editResellers catch",
            body: req.body,
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

//Add reseller users
exports.addResellerUser = async (req, res) => {
    try {
        let data = req.body
        let checkReseller = await resellerService.getReseller({ _id: data.resellerId }, {})
        // let checkDealer = await resellerService.getReseller({ _id: checkReseller.dealerId }, {})
        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId }, {})

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

        let checkUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: data.resellerId, isPrimary: true } } }, { isDeleted: false })
        data.status = checkUser.metaData[0]?.status == 'no' || !checkUser.metaData[0]?.status || checkUser.metaData[0]?.status == 'false' || !data.status ? false : true;

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
            //Save Logs add reseller user
            let logData = {
                userId: req.userId,
                endpoint: "reseller/addResellerUser",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to add the data",
                    result: saveData
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to add the data"
            })
        } else {
            //Send notification
            const adminDealerQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.userAdd": true },
                            { status: true },
                            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") },
                        ]
                    }
                },
            }
            const dealerDealerQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.userAdd": true },
                            { status: true },
                            { metaId: new mongoose.Types.ObjectId(checkReseller.dealerId) },
                        ]
                    }
                },
            }
            const resellerDealerQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.userAdd": true },
                            { status: true },
                            { metaId: new mongoose.Types.ObjectId(checkReseller._id) },
                        ]
                    }
                },
            }


            let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerQuery, { email: 1 })
            let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerDealerQuery, { email: 1 })

            let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerDealerQuery, { email: 1 })

            const IDs = adminUsers.map(user => user._id)
            let notificationArray = []
            const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
            const base_url = `${process.env.SITE_URL}`
            const dealerId = dealerUsers.map(user => user._id)
            const resellerId = resellerUsers.map(user => user._id)
            let notificationData = {
                title: "Reseller User Added",
                description: `A new user for reseller ${checkReseller.name} under Dealer ${checkDealer.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                userId: req.teammateId,
                tabAction: "resellerUser",
                contentId: saveData._id,
                flag: 'reseller_user',
                endPoint: base_url + "resellerDetails/" + checkReseller._id,
                redirectionId: "resellerDetails/" + checkReseller._id,
                notificationFor: IDs
            };
            notificationArray.push(notificationData)
            notificationData = {
                title: "Reseller User Added",
                description: `A new user for reseller ${checkReseller.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                userId: req.teammateId,
                contentId: saveData._id,
                tabAction: "resellerUser",
                flag: 'reseller_user',
                endPoint: base_url + "dealer/resellerDetails/" + checkReseller._id,
                redirectionId: "dealer/resellerDetails/" + checkReseller._id,
                notificationFor: dealerId
            };
            notificationArray.push(notificationData)
            notificationData = {
                title: "New User Added",
                description: `A new user for your account has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                userId: req.teammateId,
                contentId: saveData._id,
                flag: 'reseller_user',
                endPoint: base_url + "reseller/user",
                redirectionId: "reseller/user",
                notificationFor: resellerId
            };
            notificationArray.push(notificationData)
            let createNotification = await userService.saveNotificationBulk(notificationArray);
            let settingData = await userService.getSetting({});

            let email = data.email
            let userId = saveData._id
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
            let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
            constmailing = await sgMail.send(emailConstant.servicerApproval(email,
                {
                    flag: "created",
                    link: resetLink,
                    darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                    lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                    subject: "Set Password",
                    title: settingData[0]?.title,
                    address: settingData[0]?.address,
                    role: "Reseller User",
                    servicerName: data.firstName + " " + data.lastName
                }))

            //Save Logs add reseller user
            let logData = {
                userId: req.userId,
                endpoint: "reseller/addResellerUser",
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
        //Save Logs add reseller user
        let logData = {
            userId: req.userId,
            endpoint: "reseller/addResellerUser catch",
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

//Get Reseller Servicer
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

        let checkResellerAsServicer = await resellerService.getResellers({ dealerId: checkDealer._id, status: true, isServicer: true })
        let resellerAsServicerIds = checkResellerAsServicer.map(ID=>new mongoose.Types.ObjectId(ID._id))

        let result_Array = []
        //Get Dealer Servicer
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: checkReseller.dealerId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }

        let ids = getServicersIds.map((item) => item.servicerId)
        ids = ids.concat(resellerAsServicerIds)
        var servicer = await providerService.getAllServiceProvider({
            $or:[
                { _id: { $in: ids } },
                { resellerId: { $in: ids } }
            ]
        }, {})
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

        // if (checkReseller.isServicer) {
        //     servicer.unshift(checkReseller);
        // }

        let servicerIds = servicer.map(obj => obj._id);
        let servicerIds1 = servicer.map(obj => new mongoose.Types.ObjectId(obj.dealerId));
        let servicerIds2 = servicer.map(obj => new mongoose.Types.ObjectId(obj.resellerId));
        servicerIds = servicerIds.concat(servicerIds1, servicerIds2)
        console.log("checking the data++++++++++++++++",servicerIds)

        // Get servicer with claim
        const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: "completed", resellerId: new mongoose.Types.ObjectId(req.params.resellerId) };
        const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "completed", resellerId: new mongoose.Types.ObjectId(req.params.resellerId) };
        let claimAggregateQuery1 = [
            {
                $match: servicerCompleted
            },
            {
                "$group": {
                    "_id": "$servicerId",
                    "totalAmount": {
                        "$sum": {
                            "$sum": "$totalAmount"
                        }
                    },
                },

            },
        ]
        let valueClaim = await claimService.getClaimWithAggregate(claimAggregateQuery1);
        let claimAggregateQuery = [
            {
                $match: servicerClaimsIds
            },
            {
                $group: {
                    _id: "$servicerId",
                    noOfOrders: { $sum: 1 },
                }
            },
        ]
        let numberOfClaims = await claimService.getClaimWithAggregate(claimAggregateQuery);

        const servicerUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        // { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        // { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: servicerIds }, isPrimary: true } } }
                    ]
                }
            },
            {
                $project: {
                    email: 1,
                    'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                    'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                    'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                    'position': { $arrayElemAt: ["$metaData.position", 0] },
                    'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                    'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                    'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                    'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                    'status': { $arrayElemAt: ["$metaData.status", 0] },
                    resetPasswordCode: 1,
                    isResetPassword: 1,
                    approvedStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        console.log(servicerUser.length, "---333-----------------")


        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };
        result_Array = servicer.map(servicer => {
            const matchingItem = servicerUser.find(user =>
                user.metaId?.toString() === servicer?._id?.toString() ||
                user.metaId?.toString() === servicer?.dealerId?.toString() ||
                user.metaId?.toString() === servicer?.resellerId?.toString()
            )
            const claimValue = valueClaim.find(claim => claim._id.toString() === servicer._id.toString())
            const claimNumber = numberOfClaims.find(claim => claim._id.toString() === servicer._id.toString())
            if (matchingItem) {
                return {
                    ...matchingItem, // Use toObject() to convert Mongoose document to plain JavaScript object
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
        let emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        let nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        let phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

        let filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData?.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phone)
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
}

//Get customer by reseller 
exports.getResselerByCustomer = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
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

//Get dealer by reseller 
exports.getDealerByReseller = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 });
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

//Get reseller orders
exports.getResellerOrders = async (req, res) => {
    try {
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
            paidAmount: 1,
            dueAmount: 1,
            contract: "$contract"
        };

        let query1 = { status: { $ne: "Archieved" }, resellerId: new mongoose.Types.ObjectId(req.params.resellerId) };

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

        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 1000000
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
        //Get Respective dealer
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        let userDealerIds = ordersResult.map((result) => result.dealerId?.toString());
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId);

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
            .map(result => result.customerId);

        const allUserIds = mergedArray.concat(userCustomerIds);

        const getPrimaryUser = await userService.findUserforCustomer1([
            {
                $match: {
                    $and: [
                        { metaData: { $elemMatch: { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } } } },
                        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { metaData: { $elemMatch: { metaId: { $in: allUserIds }, isPrimary: true } } }
                    ]
                }
            },
            {
                $project: {
                    email: 1,
                    'firstName': { $arrayElemAt: ["$metaData.firstName", 0] },
                    'lastName': { $arrayElemAt: ["$metaData.lastName", 0] },
                    'metaId': { $arrayElemAt: ["$metaData.metaId", 0] },
                    'position': { $arrayElemAt: ["$metaData.position", 0] },
                    'phoneNumber': { $arrayElemAt: ["$metaData.phoneNumber", 0] },
                    'dialCode': { $arrayElemAt: ["$metaData.dialCode", 0] },
                    'roleId': { $arrayElemAt: ["$metaData.roleId", 0] },
                    'isPrimary': { $arrayElemAt: ["$metaData.isPrimary", 0] },
                    'status': { $arrayElemAt: ["$metaData.status", 0] },
                    resetPasswordCode: 1,
                    isResetPassword: 1,
                    approvedStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);


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
                        (item2) => item2._id.toString() === item1.resellerId?.toString()
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
                username = getPrimaryUser.find(user => user.metaId.toString() === item.dealerName._id.toString());
            }
            if (item.resellerName) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.resellerName._id?.toString()) : {};
            }
            if (item.customerName) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.metaId?.toString() === item.customerName._id?.toString()) : {};
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

//Get reseller contracts
exports.getResellerContract = async (req, res) => {
    try {
        let data = req.body
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        // let getTheThresholdLimir = await userService.getUserById1({ roleId: process.env.super_admin, isPrimary: true })
        let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })

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
                let asServicer = (await getData).reduce((acc, servicer) => {
                    if (servicer.resellerId !== null && servicer.dealerId === null) {
                        acc.push(servicer.resellerId);
                    } else if (servicer.dealerId !== null && servicer.resellerId === null) {
                        acc.push(servicer.dealerId);
                    }
                    return acc;
                }, []);
                servicerIds = servicerIds.concat(asServicer)
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

        if (req.params.resellerId) {
            userSearchCheck = 1
            orderAndCondition.push({ resellerId: { $in: [req.params.resellerId] } })
        };

        let orderIds = []
        if (orderAndCondition.length > 0) {
            let getOrders = await orderService.getOrders({
                $and: orderAndCondition
            })
            if (getOrders.length > 0) {
                orderIds = await getOrders.map(order => order._id)
            }
        }

        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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

        if (data.startDate != "") {
            let startDate = new Date(data.startDate)
            let endDate = new Date(data.endDate)
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 999, 0)
            let dateFilter = { createdAt: { $gte: startDate, $lte: endDate } }
            contractFilterWithEligibilty.push(dateFilter)
        }

        let mainQuery = []
        if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
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
                                    serial: 1,
                                    unique_key: 1,
                                    productValue: 1,
                                    minDate: 1,
                                    status: 1,
                                    manufacture: 1,
                                    eligibilty: 1,
                                    orderUniqueKey: 1,
                                    createdAt: 1,
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
                                productValue: 1,
                                status: 1,
                                minDate: 1,
                                manufacture: 1,
                                eligibilty: 1,
                                orderUniqueKey: 1,
                                venderOrder: 1,
                                createdAt: 1,
                                totalRecords: 1
                            }
                        }
                    ],
                },

            })
        }
        let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0
        let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
        for (let e = 0; e < result1.length; e++) {
            result1[e].reason = " "
            if (!result1[e].eligibilty) {
                result1[e].reason = "Claims limit cross for this contract"
            }
            if (result1[e].status != "Active") {
                result1[e].reason = "Contract is not active"
            }

            if (new Date(result1[e].minDate) > new Date()) {

                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                };
                const formattedDate = new Date(result1[e].minDate).toLocaleDateString('en-US', options)
                result1[e].reason = "Contract will be eligible on " + " " + formattedDate
            }

            let claimQuery = [
                {
                    $match: { contractId: new mongoose.Types.ObjectId(result1[e]._id) }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
                        openFileClaimsCount: { // Count of claims where claimfile is "Open"
                            $sum: {
                                $cond: {
                                    if: { $eq: ["$claimFile", "open"] }, // Assuming "claimFile" field is correct
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    }
                }
            ]

            let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
            if (checkClaims[0]) {
                if (checkClaims[0].openFileClaimsCount > 0) {
                    result1[e].reason = "Contract has open claim"

                }
                if (checkClaims[0].isMaxClaimAmount) {

                    if (checkClaims[0].totalAmount >= result1[e].productValue) {
                        result1[e].reason = "Claim value exceed the product value limit"
                    }
                }
            }
            let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
            const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
            let overThreshold = result1[e].claimAmount > thresholdLimitValue;
            let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
            if (!overThreshold) {
                threshHoldMessage = ""
            }
            if (!thresholdLimitPercentage.isThreshHoldLimit) {
                overThreshold = false
                threshHoldMessage = ""
            }
            result1[e].threshHoldMessage = threshHoldMessage
            result1[e].overThreshold = overThreshold
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: result1,
            totalCount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Change reseller status 
exports.changeResellerStatus = async (req, res) => {
    try {
        const singleReseller = await resellerService.getReseller({ _id: req.params.resellerId });
        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ metaId: singleReseller.dealerId, isPrimary: true })
        let getPrimary = await supportingFunction.getPrimaryUser({ metaId: req.params.resellerId, isPrimary: true })
        //check Reseller dealer
        let checkDealer = await dealerService.getDealerByName({ _id: singleReseller.dealerId }, {})
        let mergedEmail;
        if (!singleReseller) {
            res.send({
                code: constant.errorCode,
                message: "Reseller not found"
            })
            return;
        }

        //Update Reseller User Status if inactive
        if (!req.body.status) {
            let resellerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.resellerId } } }
            let newValue = {
                $set: {
                    'metaData.$.status': req.body.status,
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);

        }

        else if (singleReseller.isAccountCreate && req.body.status) {
            let resellerUserCreateria = { metaData: { $elemMatch: { metaId: req.params.resellerId, isPrimary: true } } }

            let newValue = {
                $set: {
                    'metaData.$.status': req.body.status,
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

        const changedResellerStatus = await resellerService.updateReseller({ _id: req.params.resellerId }, newValue);
        if (changedResellerStatus) {
            const status_content = req.body.status ? 'Active' : 'Inactive';
            //Update status if reseller is inactive
            const updateServicer = await providerService.updateServiceProvider({ resellerId: req.params.resellerId }, { status: req.body.status })
            //Send notification to reseller,dealer and admin
            const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
            const base_url = `${process.env.SITE_URL}`
            const adminDealerrQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.resellerUpdate": true },
                            { status: true },
                            { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc") }
                        ]
                    }
                },
            }

            const dealerrQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.resellerUpdate": true },
                            { status: true },
                            { metaId: new mongoose.Types.ObjectId(checkDealer._id) }
                        ]
                    }
                },
            }
            const resellerQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "resellerNotifications.resellerUpdate": true },
                            // { status: true },
                            { metaId: new mongoose.Types.ObjectId(req.params.resellerId) }
                        ]
                    }
                },
            }
            let adminUsers = await supportingFunction.getNotificationEligibleUser(adminDealerrQuery, { email: 1 })
            let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerrQuery, { email: 1 })
            let resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerQuery, { email: 1 })
            let notificationArray = []
            let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: singleReseller.dealerId, isPrimary: true } } })
            let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.params.resellerId, isPrimary: true } } })
            let IDs = adminUsers.map(user => user._id)
            let adminEmail = adminUsers.map(user => user.email)
            let dealerId = dealerUsers.map(user => user._id)
            let dealerEmails = dealerUsers.map(user => user.email)
            let resellerId = resellerUsers.map(user => user._id)
            let mergedEmail = adminEmail.concat(dealerEmails)
            let notificationData = {
                title: "Reseller Status Updated",
                description: `The Reseller ${singleReseller.name} for dealer ${checkDealer.name} status has been updated to ${status_content} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                redirectionId: "resellerDetails/" + singleReseller._id,
                flag: 'reseller',
                endPoint: base_url + "resellerDetails/" + singleReseller._id,
                notificationFor: IDs
            };
            notificationArray.push(notificationData)
            notificationData = {
                title: "Reseller Status Updated",
                description: `The Reseller ${singleReseller.name} status has been updated to ${status_content} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                redirectionId: "dealer/resellerDetails/" + singleReseller._id,
                flag: 'reseller',
                endPoint: base_url + "dealer/resellerDetails/" + singleReseller._id,
                notificationFor: dealerId
            };
            notificationArray.push(notificationData)
            notificationData = {
                title: "Status Updated",
                description: `GetCover has updated your status to ${status_content}.`,
                userId: req.teammateId,
                redirectionId: null,
                flag: 'reseller',
                endPoint: null,
                notificationFor: resellerId
            };
            notificationArray.push(notificationData)

            let createNotification = await userService.saveNotificationBulk(notificationArray);

            // Send Email code here
            let settingData = await userService.getSetting({});
            let resetPasswordCode = randtoken.generate(4, '123456789')
            const content = req.body.status ? 'Congratulations, you can now login to our system. Please click the following link to login to the system' : "Your account has been made inactive. If you think, this is a mistake, please contact our support team at support@getcover.com"

            let resetLink = `${process.env.SITE_URL}newPassword/${getPrimary._id}/${resetPasswordCode}`

            let emailData = {
                senderName: `Dear ${singleReseller.name}`,
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                content: content,
                redirectId: status_content == "Active" ? resetLink : '',
                subject: "Update Status"
            }

            let mailing = await sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, ["noreply@getcover.com"], emailData))

            emailData = {
                senderName: singleReseller.name,
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                content: `Reseller status has been changed to ${status_content}`,
                redirectId: '',
                subject: "Update Status"
            }
            emailData.senderName = "Dear Admin"
           mailing = await sgMail.send(emailConstant.sendEmailTemplate(adminEmail, ["noreply@getcover.com"], emailData))
            emailData.senderName = `Dear ${getPrimary.metaData[0]?.firstName + " " + getPrimary.metaData[0]?.lastName}`

           mailing = await sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))

            //Save Logs change reseller status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus/:resellerId",
                body: req.body,
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
            //Save Logs change reseller status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus/:resellerId",
                body: req.body,
                response: {
                    code: constant.errorCode,
                    message: 'Unable to update reseller status!',
                    result: changedResellerStatus
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: 'Unable to update reseller status!',
            })
        }
    } catch (err) {
        //Save Logs change reseller status
        let logData = {
            userId: req.userId,
            endpoint: "reseller/changeResellerStatus/:resellerId catch",
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

//Get reseller claims
exports.getResellerClaims = async (req, res) => {
    try {
        const resellerId = req.params.resellerId ? req.params.resellerId : req.userId
        const singleReseller = await resellerService.getReseller({ _id: resellerId });

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
                            pName: 1,
                            totalAmount: 1,
                            getcoverOverAmount: 1,
                            customerOverAmount: 1,
                            customerClaimAmount: 1,
                            getCoverClaimAmount: 1,
                            dealerSku: 1,
                            servicerId: 1,
                            claimType: 1,
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
                            "contracts.coverageType": 1,
                            "contracts.orders.dealerId": 1,
                            "contracts.orders._id": 1,
                            "contracts.orders.servicerId": 1,
                            "contracts.orders.serviceCoverageType": 1,
                            "contracts.orders.coverageType": 1,
                            "contracts.orders.customerId": 1,
                            "contracts.orders.dealers.isShippingAllowed": 1,
                            "contracts.orders.dealers.accountStatus": 1,
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
                                        "isServicer": "$$reseller.isServicer",
                                        "status": "$$reseller.status"
                                    }
                                }
                            }
                        }
                    },

                ]
            }
        })
        let servicerMatch = {}
        let dealerMatch = {}
        let resellerMatch = {}
        let dateMatch = {}
        let statusMatch = {}

        if (data.servicerName != '' && data.servicerName != undefined) {
            const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
            if (checkServicer.length > 0) {
                let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
                let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
                let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
                servicerMatch = {
                    $or: [
                        { "servicerId": { $in: servicerIds } },
                        { "servicerId": { $in: dealerIds } },
                        { "servicerId": { $in: resellerIds } }
                    ]
                };
            }
            else {
                servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
            }
        }
        data.dealerName = data.dealerName ? data.dealerName : ""


        if (data.dealerName != "") {
            let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
            dealerMatch = { dealerId: { $in: dealerIds } }

        }
        data.resellerMatch = data.resellerMatch ? data.resellerMatch : ""
        if (data.resellerName != "") {
            let getReseller = await resellerService.getResellers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
            resellerMatch = { resellerId: { $in: resellerIds } }
        }

        statusMatch = {}

        if (data.dateFilter != "") {
            data.endDate = new Date(data.endDate).setHours(23, 59, 999, 0)
            if (data.dateFilter == "damageDate") {
                dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "openDate") {
                dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "closeDate") {
                dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
        }

        let claimPaidStatus = {}
        const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

        if (data.claimPaidStatus != '' && data.claimPaidStatus != undefined) {
            claimPaidStatus = { "claimPaymentStatus": data.claimPaidStatus }
        }
        else {
            claimPaidStatus = {
                $or: [
                    { "claimPaymentStatus": "Paid" },
                    { "claimPaymentStatus": "Unpaid" },
                ]
            }
        }
        let lookupQuery = [
            { $sort: { unique_key_number: -1 } },
            {
                $match:
                {
                    $and: [
                        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        claimPaidStatus,
                        { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        servicerMatch,
                        resellerMatch,
                        dealerMatch,
                        dateMatch,
                        statusMatch,
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
                        { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(resellerId) },
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
                    ]
                },
            },

        ]

        if (newQuery.length > 0) {
            lookupQuery = lookupQuery.concat(newQuery);
        }

        let allClaims = await claimService.getClaimWithAggregate(lookupQuery);

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
        let servicerName = '';
        allServicer = await providerService.getAllServiceProvider(
            { _id: { $in: allServicerIds }, status: true },
            {}
        );
        let result_Array = await Promise.all(resultFiter.map(async (item1) => {
            let servicer = []
            let mergedData = []
            if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
                mergedData = dynamicOption.value.filter(contract =>
                    item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
                );
            }
            let servicerName = '';
            let selfServicer = false;
            await Promise.all(item1.contracts.orders.dealers.dealerServicer.map(async (matched) => {
                const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
                if (dealerOfServicer) {
                    servicer.push(dealerOfServicer);
                }
            }));

            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }

            let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
            let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
            if (dealerResellerServicer.length > 0) {
                let dealerResellerServicer = await providerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
                servicer = servicer.concat(dealerResellerServicer);
            }
            // if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
            //     let checkResellerServicer = await providerService.getServiceProviderById({ resellerId: item1.contracts.orders.resellers[0]._id })

            //     servicer.push(checkResellerServicer)

            //   }

            if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
                let checkDealerServicer = await providerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })
                servicer.push(checkDealerServicer)
            }

            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false

            }
            return {
                ...item1,
                servicerData: servicerName,
                selfServicer: selfServicer,
                contracts: {
                    ...item1.contracts,
                    allServicer: servicer,
                    mergedData: mergedData

                }
            }
        }));

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

exports.getResellerAsServicerClaims = async (req, res) => {
    try {
        const resellerId = req.params.resellerId ? req.params.resellerId : req.userId
        const singleReseller = await resellerService.getReseller({ _id: resellerId });

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
                            pName: 1,
                            totalAmount: 1,
                            getcoverOverAmount: 1,
                            customerOverAmount: 1,
                            customerClaimAmount: 1,
                            getCoverClaimAmount: 1,
                            dealerSku: 1,
                            servicerId: 1,
                            claimType: 1,
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
                            "contracts.coverageType": 1,
                            "contracts.orders.dealerId": 1,
                            "contracts.orders._id": 1,
                            "contracts.orders.servicerId": 1,
                            "contracts.orders.serviceCoverageType": 1,
                            "contracts.orders.coverageType": 1,
                            "contracts.orders.customerId": 1,
                            "contracts.orders.dealers.isShippingAllowed": 1,
                            "contracts.orders.dealers.accountStatus": 1,
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
        let servicerMatch = {}
        let dealerMatch = {}
        let resellerMatch = {}
        let dateMatch = {}
        let statusMatch = {}
        const checkServicer = await providerService.getAllServiceProvider({ resellerId: new mongoose.Types.ObjectId(resellerId) });
        let servicerIdToCheck = checkServicer[0]?._id

        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer?._id))
        servicerIds.push(new mongoose.Types.ObjectId(resellerId))
        servicerMatch = {
            $or: [
                { "servicerId": { $in: servicerIds } }
            ]
        };
        // if (data.servicerName != '' && data.servicerName != undefined) {
        //     const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
        //     if (checkServicer.length > 0) {
        //         let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        //         let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        //         let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
        //         servicerMatch = {
        //             $or: [
        //                 { "servicerId": { $in: servicerIds } },
        //                 { "servicerId": { $in: dealerIds } },
        //                 { "servicerId": { $in: resellerIds } }
        //             ]
        //         };
        //     }
        //     else {
        //         servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
        //     }
        // }
        data.dealerName = data.dealerName ? data.dealerName : ""


        if (data.dealerName != "") {
            let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
            dealerMatch = { dealerId: { $in: dealerIds } }

        }
        data.resellerMatch = data.resellerMatch ? data.resellerMatch : ""
        if (data.resellerName != "") {
            let getReseller = await resellerService.getResellers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
            let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
            resellerMatch = { resellerId: { $in: resellerIds } }
        }

        statusMatch = {}

        if (data.dateFilter != "") {
            data.endDate = new Date(data.endDate).setHours(23, 59, 999, 0)
            if (data.dateFilter == "damageDate") {
                dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "openDate") {
                dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
            if (data.dateFilter == "closeDate") {
                dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: new Date(data.endDate) } }
                statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
            }
        }

        let claimPaidStatus = {}
        const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

        if (data.claimPaidStatus != '' && data.claimPaidStatus != undefined) {
            claimPaidStatus = { "claimPaymentStatus": data.claimPaidStatus }
        }
        else {
            claimPaidStatus = {
                $or: [
                    { "claimPaymentStatus": "Paid" },
                    { "claimPaymentStatus": "Unpaid" },
                ]
            }
        }
        let lookupQuery = [
            { $sort: { unique_key_number: -1 } },
            {
                $match:
                {
                    $and: [
                        { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        claimPaidStatus,
                        { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        servicerMatch,
                        resellerMatch,
                        dealerMatch,
                        dateMatch,
                        statusMatch,
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
                        { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                        // { "contracts.orders.resellerId": new mongoose.Types.ObjectId(resellerId) },
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
                    ]
                },
            },

        ]

        if (newQuery.length > 0) {
            lookupQuery = lookupQuery.concat(newQuery);
        }

        let allClaims = await claimService.getClaimWithAggregate(lookupQuery);

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
        let servicer;
        let servicerName = '';
        allServicer = await providerService.getAllServiceProvider(
            { _id: { $in: allServicerIds }, status: true },
            {}
        );


        let result_Array = await Promise.all(resultFiter.map(async (item1) => {
            servicer = []
            let mergedData = []
            if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
                mergedData = dynamicOption.value.filter(contract =>
                    item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
                );
            }
            let servicerName = '';
            let selfServicer = false;
            await Promise.all(item1.contracts.orders.dealers.dealerServicer.map(async (matched) => {
                const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
                if (dealerOfServicer) {
                    servicer.push(dealerOfServicer);
                }
            }));

            if (item1.contracts.orders.servicers[0]?.length > 0) {
                servicer.unshift(item1.contracts.orders.servicers[0])
            }


            // if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
            //     let checkResellerServicer = await providerService.getServiceProviderById({ resellerId: item1.contracts.orders.resellers[0]._id })
            //     servicer.push(checkResellerServicer)
            // }
            let dealerResellerServicer = await resellerService.getResellers({ dealerId: item1.contracts.orders.dealers._id, isServicer: true, status: true })
            let resellerIds = dealerResellerServicer.map(resellers => resellers._id);
            if (dealerResellerServicer.length > 0) {
                let dealerResellerServicer = await providerService.getAllServiceProvider({ resellerId: { $in: resellerIds } })
                servicer = servicer.concat(dealerResellerServicer);
            }

            if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
                let checkDealerServicer = await providerService.getServiceProviderById({ dealerId: item1.contracts.orders.dealers._id })

                servicer.push(checkDealerServicer)
            }
            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false

            }
            return {
                ...item1,
                servicerData: servicerName,
                selfServicer: selfServicer,
                contracts: {
                    ...item1.contracts,
                    allServicer: servicer,
                    mergedData: mergedData

                }
            }
        }));

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