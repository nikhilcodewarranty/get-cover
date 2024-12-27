require('dotenv').config()
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService")
const servicerService = require("../../services/Provider/providerService")
const claimService = require("../../services/Claim/claimService")
const contractService = require("../../services/Contract/contractService")
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const customerService = require("../../services/Customer/customerService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const LOG = require('../../models/User/logs')
const optionService = require("../../services/User/optionsService");
const userService = require("../../services/User/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const supportingFunction = require('../../config/supportingFunction')
const reportingController = require("../../controllers/User/reportingController");
const providerService = require('../../services/Provider/providerService');
const resellerService = require('../../services/Dealer/resellerService');
const moment = require("moment");
const pdf = require('html-pdf');
const XLSX = require("xlsx");
const mongoose = require('mongoose');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const randtoken = require('rand-token').generator()
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
aws.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
});
const S3Bucket = new aws.S3();

// s3 bucket connections
const s3 = new S3Client({
    region: process.env.region,
    credentials: {
        accessKeyId: process.env.aws_access_key_id,
        secretAccessKey: process.env.aws_secret_access_key,
    }
});
const folderName = 'resultFile'; // Replace with your specific folder name
const StorageP = multerS3({
    s3: s3,
    bucket: process.env.bucket_name,
    metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
        const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
        const fullPath = `${folderName}/${fileName}`;
        cb(null, fullPath);
    }
});

var uploadP = multer({
    storage: StorageP,
}).single('file');

var upload = multer({
    storage: StorageP,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB limit
    },
}).array("file", 100);

//price api
exports.createDealerPriceBook = async (req, res) => {
    try {
        let data = req.body
        const count = await dealerPriceService.getDealerPriceCount();
        data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
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
            //Save Logs for create price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createDealerPriceBook",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to create the dealer price book"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to create the dealer price book"
            })
        } else {
            //Save Logs for create price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createDealerPriceBook",
                body: data,
                response: {
                    code: constant.successCode,
                    message: "Success",
                    result: createDealerPrice
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Success",
                result: createDealerPrice
            })
        }
    } catch (err) {
        //Save Logs for create price book 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createDealerPriceBook catch",
            body: req.body ? req.body : { type: "Catch error" },
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
};

//Get customer orders
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

        const orderIdRegex = new RegExp(data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', 'i')
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
};

//Status update
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

        let data = req.body;
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
            //Save Logs for update price book
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/updateDealerPriceBook",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to update the dealer price status"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to update the dealer price status"
            });
            return;
        }
        //Save Logs for update price book
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/updateDealerPriceBook",
            body: data,
            response: {
                code: constant.successCode,
                message: "Updated Successfully",
                data: updatedResult
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.successCode,
            message: "Updated Successfully",
            data: updatedResult
        });

        return

    } catch (err) {
        //Save Logs for update price book
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/updateDealerPriceBook catch",
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
        return
    }
};

//Create relation with dealer
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
        let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
        let checkId = trueArray.map(record => record._id)
        const existingRecords = await dealerRelationService.getDealerRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: checkId }
        });
        // Step 2: Separate existing and non-existing servicer IDs
        const existingServicerIds = existingRecords.map(record => record.servicerId.toString());
        const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));
        // Step 3: Delete existing records
        let deleteData = await dealerRelationService.deleteRelations({
            dealerId: new mongoose.Types.ObjectId(req.userId),
            servicerId: { $in: uncheckId }
        });
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
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//customers api
exports.createCustomer = async (req, res, next) => {
    try {
        let data = req.body;
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
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
                        { metaId: new mongoose.Types.ObjectId(checkDealer._id) },
                    ]
                }
            },
        }
        let resellerQuery
        let resellerUsers = []
        if (data?.resellerName) {
            resellerQuery = {
                metaData: {
                    $elemMatch: {
                        $and: [
                            { "customerNotifications.customerAdded": true },
                            { status: true },
                            { metaId: new mongoose.Types.ObjectId(data?.resellerName) },


                        ]
                    }
                },
            }
            resellerUsers = await supportingFunction.getNotificationEligibleUser(resellerQuery, { email: 1 })

        }


        let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1 })
        let dealerUsers = await supportingFunction.getNotificationEligibleUser(dealerQuery, { email: 1 })
        const IDs = adminUsers.map(user => user._id)
        const dealerId = dealerUsers.map(user => user._id)
        const resellerId = resellerUsers.map(user => user._id)
        // Primary User Welcoime email
        let notificationEmails = adminUsers.map(user => user.email)
        let mergedEmail;
        let dealerEmails = dealerUsers.map(user => user.email)
        let resellerEmails = resellerUsers.map(user => user.email)
        mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        // check customer acccount name 
        let checkAccountName = await customerService.getCustomerByName({
            username: new RegExp(`^${data.accountName}$`, 'i'), dealerId: req.userId
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
            isAccountCreate: !checkDealer.userAccount ? false : data.status,
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
        data._id = createdCustomer._id;
        if (!createdCustomer) {
            //Save Logs create Customer
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createCustomer",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to create the customer"
                }
            }
            await LOG(logData).save()
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
                        dialCode: member?.dialCode,
                        status: !data.status ? false : member.status,
                        isPrimary: member.isPrimary
                    }
                ],
            approvedStatus: "Approved",

        })
        );
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)
        // Primary User Welcoime email
        let settingData = await userService.getSetting({});

        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })
        let resellerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkReseller?._id, isPrimary: true } } })
        //Merge end
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.metaData[0]?.firstName,
            redirectId: base_url + "customerDetails/" + createdCustomer._id,
            content: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            subject: "New Customer Added"
        }

        // Send Email code here
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ['noreply@getcover.com'], emailData))

        if (saveMembers.length > 0) {
            if (data.status) {
                for (let i = 0; i < saveMembers.length; i++) {
                    if (saveMembers[i].status) {
                        let email = saveMembers[i].email
                        let userId = saveMembers[i]._id
                        let resetPasswordCode = randtoken.generate(4, '123456789')
                        let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                        let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                        const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email,
                            {
                                flag: "created",
                                title: settingData[0]?.title,
                                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                                address: settingData[0]?.address,
                                link: resetLink,
                                subject: "Set Password", role: "Customer",
                                servicerName: saveMembers[i].firstName
                            }))
                    }

                }
            }
        }
        //Send Notification to customer,admin,reseller,dealer 
        let notificationArray = []
        //Send Notification to customer,admin,reseller,dealer 
        let notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: IDs,
            redirectionId: "customerDetails/" + createdCustomer._id,
            endpoint: base_url + "customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: dealerId,
            redirectionId: "dealer/customerDetails/" + createdCustomer._id,
            endpoint: base_url + "dealer/customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        notificationData = {
            title: "New Customer  Added",
            description: `A New Customer ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: resellerId,
            redirectionId: "reseller/customerDetails/" + createdCustomer._id,
            endpoint: base_url + "reseller/customerDetails/" + createdCustomer._id,
        };
        notificationArray.push(notificationData)
        let createNotification = await userService.saveNotificationBulk(notificationArray);
        //Save Logs create Customer
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createCustomer",
            body: data,
            response: {
                code: constant.errorCode,
                message: "Customer created successfully",
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.successCode,
            message: "Customer created successfully",
            result: createdCustomer
        })
    } catch (err) {
        //Save Logs create Customer
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createCustomer",
            body: req.body ? req.body : { type: "Catch error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//Create reseller
exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
        const base_url = `${process.env.SITE_URL}`
        let getCount = await resellerService.getResellersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId, accountStatus: true }, {});
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
        let isAccountCreate = data.status
        let resellerObject = {
            name: data.accountName,
            street: data.street,
            isAccountCreate: isAccountCreate,
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
            //Save Logs for create reseller 
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createReseller",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to create the reseller"
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to create the reseller"
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
                status: true,
                accountStatus: "Approved",
                unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
        }
        // Primary User Welcoime email

        //Send Bell Icon notification
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
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)
        let mergedEmail = notificationEmails.concat(dealerEmails)
        let notificationData = {
            title: "New Reseller  Added",
            description: `A New Reseller ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            redirectionId: "resellerDetails/" + createdReseler._id,
            endpoint: base_url + "resellerDetails/" + createdReseler._id,
            flag: 'reseller',
            notificationFor: IDs
        };
        notificationArray.push(notificationData)

        notificationData = {
            title: "New Reseller  Added",
            description: `A New Reseller ${data.accountName} has been added and approved by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName} - User Role - ${req.role} on our portal.`,
            userId: req.teammateId,
            redirectionId: "resellerDetails/" + createdReseler._id,
            endpoint: base_url + "dealer/resellerDetails/ " + createdReseler._id,
            flag: 'reseller',
            notificationFor: dealerId
        };
        notificationArray.push(notificationData)

        let createNotification = await userService.saveNotificationBulk(notificationArray);

        let settingData = await userService.getSetting({});
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkDealer._id, isPrimary: true } } })

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
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(mergedEmail, ['noreply@getcover.com'], emailData))


        if (data.status) {
            for (let i = 0; i < saveMembers.length; i++) {
                if (saveMembers[i].status) {
                    let email = saveMembers[i].email
                    let userId = saveMembers[i]._id
                    let resetPasswordCode = randtoken.generate(4, '123456789')
                    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                    const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email,
                        {
                            flag: "created",
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            link: resetLink, subject: "Set Password",
                            role: "Reseller",
                            title: settingData[0]?.title,
                            address: settingData[0]?.address,
                            servicerName: saveMembers[i].firstName
                        }))
                }
            }
        }
        //Save Logs for create reseller 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createReseller",
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
        //Save Logs for create reseller 
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createReseller catch",
            body: req.body ? req.body : { type: "catch error" },
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
};

//create order
exports.createOrder = async (req, res) => {
    try {
        // upload(req, res, async (err) => {
        let data = req.body;
        data.dealerPurchaseOrder = data.dealerPurchaseOrder.trim().replace(/\s+/g, ' ');
        data.resellerId = data.resellerId == 'null' ? null : data.resellerId;
        data.venderOrder = data.dealerPurchaseOrder;
        let projection = { isDeleted: 0 };
        var checkDealer = await dealerService.getDealerById(
            req.userId,
            projection
        );
        const orderTermCondition = data.termCondition != null ? data.termCondition : {}
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
        data.dealerId = req.userId;
        data.servicerId = data.servicerId != "" ? data.servicerId : null;
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
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
        // Update Term and condtion while create order
        let uploadTermAndCondtion = await orderService.updateOrder(
            { _id: savedResponse._id },
            { termCondition: orderTermCondition },
            { new: true }
        );
        if (!savedResponse) {
            //Save Logs for create order
            let logData = {
                userId: req.userId,
                endpoint: "dealerPortal/createOrder",
                body: data,
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

        //Save Logs for create order
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createOrder",
            body: data,
            response: {
                code: constant.successCode,
                message: 'Success!'
            }
        }
        await LOG(logData).save()

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
            },
        }
        let dealerPendingQuery = {
            metaData: {
                $elemMatch: {
                    $and: [
                        { "orderNotifications.addingNewOrderPending": true },
                        { status: true },
                        { metaId: savedResponse.dealerId },
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
                        { metaId: savedResponse?.resellerId ? savedResponse?.resellerId : "000008041eb1acda24111111" }
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
        let getPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: req.userId, isPrimary: true } } })

        let settingData = await userService.getSetting({});
        let notificationData = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs
        };
        let notificationData1 = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "dealer/editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs1
        };
        let notificationData2 = {
            title: "Draft Order Created",
            description: `A new draft Order # ${savedResponse.unique_key} has been created by ${checkLoginUser.metaData[0].firstName + " " + checkLoginUser.metaData[0].lastName}  - ${req.role}.`,
            userId: req.teammateId,
            contentId: null,
            flag: 'edit_order',
            redirectionId: "reseller/editOrder/" + savedResponse._id,
            endPoint: base_url + "editOrder/" + savedResponse._id,
            notificationFor: IDs2
        };
        let notificationArrayData = []
        notificationArrayData.push(notificationData)
        notificationArrayData.push(notificationData1)
        notificationArrayData.push(notificationData2)
        let createNotification = await userService.saveNotificationBulk(notificationArrayData);
        // Send Email code here
        let notificationEmails = adminUsers.map(user => user.email)
        let dealerEmails = dealerUsers.map(user => user.email)
        let resellerEmails = resellerUsers.map(user => user.email)
        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: '',
            content: `A new Order # ${savedResponse.unique_key} has been created. The order is still in the pending state. To complete the order please click here and fill the data`,
            subject: "New Order",
            redirectId: base_url + "editOrder/" + savedResponse._id,
        }
        if (req.body.sendNotification) {
            let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
            emailData.redirectId = base_url + "reseller/editOrder/" + savedResponse._id
            mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
            emailData.redirectId = base_url + "dealer/editOrder/" + savedResponse._id
            mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
        }


        res.send({
            code: constant.successCode,
            message: 'Success!'
        })

    } catch (err) {
        //Save Logs for create order
        let logData = {
            userId: req.userId,
            endpoint: "dealerPortal/createOrder catch",
            body: req.body ? req.body : { type: "Catch error" },
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
};

//Edit order detail
exports.editOrderDetail = async (req, res) => {
    try {
        let data = req.body;
        let notificationArrayData = []

        let logData = {
            endpoint: "dealerPortal/editOrderDetail",
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

        let checkDealer = await dealerService.getDealerById(
            req.userId
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
        data.resellerId = data.resellerId != "" ? data.resellerId : null;
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
                req.userId
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

        //send notification to dealer,reseller,admin,customer


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
                let dealerQuery = { priceBook: new mongoose.Types.ObjectId(priceBookId), dealerId: req.userId };

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
                        endPoint: base_url + "orderDetails/" + checkOrder._id,
                        notificationFor: IDs
                    };
                    let notificationData1 = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "dealer/orderDetails/" + checkOrder._id,
                        endPoint: base_url + "dealer/orderDetails/" + checkOrder._id,
                        notificationFor: IDs1
                    };
                    let notificationData2 = {
                        title: "New Active Order Created Successfully",
                        description: `The draft Order # ${checkOrder.unique_key} has been marked completed successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "reseller/orderDetails/" + checkOrder._id,
                        endPoint: base_url + "reseller/orderDetails/" + checkOrder._id,
                        notificationFor: IDs2
                    };
                    let notificationData3 = {
                        title: "New Active Order Created Successfully",
                        description: `A new Order #${checkOrder.unique_key} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} - ${req.role}.`,
                        userId: req.teammateId,
                        contentId: checkOrder._id,
                        flag: 'order',
                        redirectionId: "customer/orderDetails/" + checkOrder._id,
                        endPoint: base_url + "customer/orderDetails/" + checkOrder._id,
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
                    if (!checkOrder?.termCondition || checkOrder?.termCondition == null || checkOrder?.termCondition == '') {
                        let notificationEmails = adminUsers.map(user => user.email)
                        let dealerEmails = dealerUsers.map(user => user.email)
                        let resellerEmails = resellerUsers.map(user => user.email)
                        let customerEmails = customerUsers.map(user => user.email)
                        let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails, customerEmails)
                        let emailData = {
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            websiteSetting: settingData[0],
                            senderName: '',
                            content: `Congratulations, your order # ${checkOrder.unique_key} has been created in our system. Please login to the system and view your order details. Please review, if there is anything wrong here, do let us know. You can contact us at : support@getcover.com`,
                            subject: "Process Order",
                            redirectId: base_url + "orderDetails/" + checkOrder._id,
                        }
                        if (req.body.sendNotification) {
                            let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "dealer/orderDetails/" + checkOrder._id
                            mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "reseller/orderDetails/" + checkOrder._id

                            mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
                            emailData.redirectId = base_url + "customer/orderDetails/" + checkOrder._id
                            mailing = sgMail.send(emailConstant.sendEmailTemplate(customerEmails, ["noreply@getcover.com"], emailData))
                        }

                    }

                    // Customer Email here with T and C
                    //generate T anc C

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
                flag: 'edit_order',
                redirectionId: "editOrder/" + checkOrder._id,
                endPoint: base_url + "editOrder/" + checkOrder._id,
                notificationFor: IDs
            };
            let notificationData1 = {
                title: "Draft Order Updated Successfully",
                description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                contentId: checkOrder._id,
                flag: 'edit_order',
                redirectionId: "dealer/editOrder/" + checkOrder._id,
                endPoint: base_url + "dealer/editOrder/" + checkOrder._id,
                notificationFor: IDs1
            };
            let notificationData2 = {
                title: "Draft Order Updated Successfully",
                description: `The draft Order # ${checkOrder.unique_key} has been updated successfully by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
                userId: req.teammateId,
                contentId: checkOrder._id,
                flag: 'edit_order',
                redirectionId: "reseller/editOrder/" + checkOrder._id,
                endPoint: base_url + "reseller/editOrder/" + checkOrder._id,
                notificationFor: IDs2
            };
            notificationArrayData.push(notificationData)
            notificationArrayData.push(notificationData1)
            notificationArrayData.push(notificationData2)

            let dealerPrimary = await supportingFunction.getPrimaryUser({ metaData: { $elemMatch: { metaId: checkOrder.dealerId, isPrimary: true } } })
            let createNotification = await userService.saveNotificationBulk(notificationArrayData);

            // Send Email code here
            let notificationEmails = adminUsers.map(user => user.email)
            let dealerEmails = dealerUsers.map(user => user.email)
            let resellerEmails = resellerUsers.map(user => user.email)
            let mergedEmail = notificationEmails.concat(dealerEmails, resellerEmails)
            let settingData = await userService.getSetting({});

            let emailData = {
                darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                address: settingData[0]?.address,
                websiteSetting: settingData[0],
                senderName:'',
                // senderName: dealerPrimary.firstName,
                content: "Your order " + checkOrder.unique_key + " has been updated in our system. The order is still pending, as there is some data missing.Please update the data using the link here",
                subject: "Order Updated",
                redirectId: base_url + "editOrder/" + checkOrder._id,
            }
            if (req.body.sendNotification) {
                emailData.redirectId = base_url + "dealer/editOrder/" + checkOrder._id
                let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerEmails, ["noreply@getcover.com"], emailData))
                emailData.redirectId = base_url + "reseller/editOrder/" + checkOrder._id
                mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerEmails, ["noreply@getcover.com"], emailData))
                emailData.redirectId = base_url + "editOrder/" + checkOrder._id
                mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
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
        let otherInfo = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            return contractService.getContractById({
                orderProductId: item._id
            });

        })
        const contractArray = await Promise.all(contractArrayPromise);

        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            let anotherObj = {
                coverageStartDate: checkOrder?.productsArray[i]?.coverageStartDate,
                coverageEndDate: checkOrder?.productsArray[i]?.coverageEndDate,
                term: checkOrder?.productsArray[i]?.term
            }
            otherInfo.push(anotherObj)
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {

                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: checkOrder?.productsArray[i]?.dealerSku,
                        noOfProducts: quanitityProduct.enterQuantity,

                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())

                let obj = {
                    productName: findContract?.dealerSku,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts,
                }
                productCoveredArray.push(obj)
            }

        }
        // return;
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');


        const coverageStartDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageStartDate).format("MM/DD/YYYY")}</p>
`).join('');

        const coverageEndDates = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${moment(product.coverageEndDate).format("MM/DD/YYYY")}</p>
`).join('');

        const term = otherInfo.map((product, index) => `
    <p style="font-size:13px;">${otherInfo.length > 1 ? `Product #${index + 1}: ` : ''}${product.term / 12} ${product.term / 12 === 1 ? 'Year' : 'Years'}</p>
`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
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
        let mergeFileName = checkOrder.unique_key + '_' + Date.now() + '.pdf'
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
                    <td style="font-size:13px;"> ${coverageStartDates}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;">GET COVER service contract period:</td>
                <td style="font-size:13px;">
                ${term} 
                </td>
            </tr>
            <tr>
            <td style="font-size:13px;padding:15px;">Coverage End Date:</td>
            <td style="font-size:13px;">${coverageEndDates}</td >
          </tr >
        
       
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
            //send notification to admin and dealer 
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
        res.send({
            code: constant.errorCode,
            message: err.message
        })
        return;
    }
}

//Add claim 
exports.addClaim = async (req, res, next) => {
    try {
        if (req.role != 'Dealer') {
            res.send({
                code: constant.errorCode,
                message: 'Only dealer allow to do this action!'
            });
            return;
        }
        let data = req.body;
        let checkContract = await contractService.getContractById({ _id: data.contractId })
        if (!checkContract) {
            res.send({
                code: constant.errorCode,
                message: "Contract not found!"
            })
            return;
        }

        if (data.servicerId) {
            let checkServicer = await servicerService.getServiceProviderById({
                $or: [
                    { _id: data.servicerId },
                    { resellerId: data.servicerId },
                    { dealerId: data.servicerId },

                ]
            })
            if (!checkServicer) {
                res.send({
                    code: constant.errorCode,
                    message: "Servicer not found!"
                })
                return;
            }
        }

        if (new Date(checkContract.coverageStartDate) > new Date(data.lossDate)) {
            res.send({
                code: constant.errorCode,
                message: 'Loss date should be in between coverage start date and present date!'
            });
            return;
        }

        if (checkContract.status != 'Active') {
            res.send({
                code: constant.errorCode,
                message: 'The contract is not active!'
            });
            return;
        }



        let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'open' })
        if (checkClaim) {
            res.send({
                code: constant.errorCode,
                message: 'The previous claim is still open!'
            });
            return
        }


        const query = { contractId: new mongoose.Types.ObjectId(data.contractId) }
        let claimTotalQuery = [
            { $match: query },
            { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

        ]
        let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);

        if (data.coverageType != "") {
            let checkCoverageTypeForContract = checkContract.coverageType.find(item => item.value == data.coverageType)
            if (!checkCoverageTypeForContract) {
                res.send({
                    code: constant.errorCode,
                    message: 'Coverage type is not available for this contract!'
                })
                return;
            }
            let startDateToCheck = new Date(checkContract.coverageStartDate)
            let coverageTypeDays = checkContract.adhDays
            let serviceCoverageType = checkContract.serviceCoverageType

            let getDeductible = coverageTypeDays.filter(coverageType => coverageType.value == data.coverageType)

            let checkCoverageTypeDate = startDateToCheck.setDate(startDateToCheck.getDate() + Number(getDeductible[0].waitingDays))

            let getCoverageTypeFromOption = await optionService.getOption({ name: "coverage_type" })
            console.log("getCoverageTypeFromOption", getCoverageTypeFromOption)
            const result = getCoverageTypeFromOption.value.filter(item => item.value === data.coverageType).map(item => item.label);
            console.log(new Date(checkCoverageTypeDate).setHours(0, 0, 0, 0));
            checkCoverageTypeDate = new Date(checkCoverageTypeDate).setHours(0, 0, 0, 0)
            data.lossDate = new Date(data.lossDate).setHours(0, 0, 0, 0)
            if (new Date(checkCoverageTypeDate) > new Date(data.lossDate)) {
                // claim not allowed for that coverageType
                res.send({
                    code: 403,
                    tittle: `Claim not eligible for ${result[0]}.`,
                    // message: `Your selected ${result[0]} is currently not eligible for the claim. You can file the claim for ${result[0]} on ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}. Do you wish to proceed in rejecting this claim?`
                    message: `Your claim for ${result[0]} cannot be filed because it is not eligible based on the loss date. You will be able to file this claim starting on ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}. Would you like to proceed with rejecting the claim now?`
                })
                return

            }

        }

        // if (checkContract.productValue < claimTotal[0]?.amount) {
        //     res.send({
        //         code: consta.errorCode,
        //         message: 'Claim Amount Exceeds Contract Retail Price'
        //     });
        //     return;
        // }
        data.receiptImage = data.file
        data.servicerId = data.servicerId ? data.servicerId : null
        let currentYear = new Date().getFullYear();
        let currentYearWithoutHypen = new Date().getFullYear();
        console.log(currentYear); // Outputs: 2024
        currentYear = "-" + currentYear + "-"
        let count = await claimService.getClaimCount({ 'unique_key': { '$regex': currentYear, '$options': 'i' } });

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "CC" + currentYearWithoutHypen + data.unique_key_number
        data.unique_key = "CC" + currentYear + data.unique_key_number
        let claimResponse = await claimService.createClaim(data)
        if (!claimResponse) {
            res.send({
                code: constant.errorCode,
                message: 'Unable to add claim of this contract!'
            });
            return
        }
        // Eligibility false when claim open
        const updateContract = await contractService.updateContract({ _id: data.contractId }, { eligibilty: false }, { new: true })
        res.send({
            code: constant.successCode,
            message: 'Success!',
            result: claimResponse
        })


    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        })
    }
};

//Sale reporting
exports.saleReporting = async (req, res) => {
    try {
        let bodyData = req.body
        bodyData.returnValue = {
            total_broker_fee: 1,
            total_admin_fee: 1,
            total_fronting_fee: 1,
            total_reserve_future_fee: 1,
            total_contracts: 1,
            total_reinsurance_fee: 1,
            wholesale_price: 1
        };

        bodyData.dealerId = new mongoose.Types.ObjectId(req.userId)
        bodyData.role = req.role
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

//Claim Reporting
exports.claimReporting = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById({ _id: req.userId })
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
        data.isServicer = checkDealer.isServicer

        if (data.flag == "daily") {
            data.dealerId = req.userId
            let claim = await reportingController.claimDailyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim,
                isServicer: checkDealer.isServicer
            })
        } else if (data.flag == "weekly") {
            data.dealerId = req.userId
            let claim = await reportingController.claimWeeklyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim,
                isServicer: checkDealer.isServicer
            })
        } else if (data.flag == "day") {
            data.dealerId = req.userId
            let claim = await reportingController.claimDayReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim,
                isServicer: checkDealer.isServicer
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Sale reporting dropdown 
exports.saleReportinDropDown = async (req, res) => {
    try {
        let data = req.body
        let result;
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }, { name: 1 })
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
        data.dealerId = req.userId
        console.log("data.--------------------", data.dealerId)
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

//claim reporting
exports.claimReportinDropdown = async (req, res) => {
    try {
        let data = req.body
        let result;
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.userId })
        let ids = getServicersIds?.map((item) => item.servicerId)
        let getDealers = await dealerService.getAllDealers({ status: "Approved" }) // not using
        let getServicer = await providerService.getAllServiceProvider({
            $or: [
                { dealerId: req.userId },
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

            let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: req.userId })
            let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
            let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
            let categoriesIds = getPriceBooks1.map(ID => ID.category)
            let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })

            if (data.categoryId != "") {
                getPriceBooks1 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
            }
            if (data.priceBookId.length != 0 && data.categoryId == "") {
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

            if (data.priceBookId.length != 0 && data.categoryId == "") {
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
            if (req.role == "Dealer") {
                let dealerQuery = [
                    {
                        $match:
                        {
                            _id: new mongoose.Types.ObjectId(req.userId)
                        },
                    },
                    {
                        $lookup: {
                            from: "servicer_dealer_relations",
                            localField: "_id",
                            foreignField: "dealerId",
                            as: "dealerServicer" // Keep dealerPricebookData as an array
                        }
                    },
                    {
                        $lookup: {
                            from: "resellers",
                            localField: "_id",
                            foreignField: "dealerId",
                            as: "resellersData" // Keep dealerPricebookData as an array
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
                            from: "serviceproviders",
                            let: {
                                id: "$_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $eq: [{ $toObjectId: "$dealerId" }, "$$id"] },
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
                            from: "serviceproviders",
                            let: {
                                resellerIds: "$resellersData._id" // Resellers associated with the dealer
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $isArray: "$$resellerIds" }, // Ensure it's an array
                                                { $in: [{ $toObjectId: "$resellerId" }, "$$resellerIds"] } // Convert resellerId to ObjectId and match
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
                            from: "dealerpricebooks",
                            localField: "_id",
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
                ];

                response = await dealerService.getTopFiveDealers(dealerQuery)
            }
            if (req.role == "Reseller") {
                console.log("dfsdfdsfdsdfsd")
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

//Upload to S3
const uploadToS3 = async (filePath, bucketName, key) => {
    const fs = require('fs').promises;
    const fileContent = await fs.readFile(filePath);
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
    };
    return S3.upload(params).promise();
};

//Download to S3
const downloadFromS3 = async (bucketName, key) => {
    const params = {
        Bucket: bucketName,
        Key: key,
    };
    const data = await S3.getObject(params).promise();
    return data.Body;
};






