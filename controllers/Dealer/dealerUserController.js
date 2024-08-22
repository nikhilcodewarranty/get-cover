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
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        let getCount = await customerService.getCustomersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        let IDs = await supportingFunction.getUserIds()
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
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdCustomer._id, status: !data.status ? false : member.status, metaId: createdCustomer._id, roleId: process.env.customer }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)
        // Primary User Welcoime email
        let notificationEmails = await supportingFunction.getUserEmails();
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
        let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkReseller?._id, isPrimary: true })
        notificationEmails.push(getPrimary.email)
        notificationEmails.push(resellerPrimary?.email)

        let settingData = await userService.getSetting({});

        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: getPrimary.firstName,
            content: "We are delighted to inform you that the customer account for " + createdCustomer.username + " has been created.",
            subject: "Customer Account Created - " + createdCustomer.username
        }

        // Send Email code here
        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
        if (saveMembers.length > 0) {
            if (data.status) {
                for (let i = 0; i < saveMembers.length; i++) {
                    if (saveMembers[i].status) {
                        let email = saveMembers[i].email
                        let userId = saveMembers[i]._id
                        let resetPasswordCode = randtoken.generate(4, '123456789')
                        let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                        let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                        // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink }))
                        const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, {
                            link: resetLink,
                            role: "Customer",
                            flag: "created",
                            subject: "Set Password",
                            title: settingData[0]?.title,
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            servicerName: saveMembers[i].firstName
                        }))

                    }

                }
            }
        }
        //Send Notification to customer,admin,reseller,dealer 
        IDs.push(getPrimary._id)
        IDs.push(resellerPrimary?._id)
        let notificationData = {
            title: "New Customer Created",
            description: data.accountName + " " + "customer account has been created successfully!",
            userId: req.teammateId,
            flag: 'customer',
            notificationFor: IDs
        };
        let createNotification = await userService.createNotification(notificationData);
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
            result: data
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
                status: true,
                accountStatus: "Approved",
                unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
        }
        // Primary User Welcoime email
        let notificationEmails = await supportingFunction.getUserEmails();
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: checkDealer._id, isPrimary: true })
        notificationEmails.push(getPrimary.email)
        let settingData = await userService.getSetting({});
        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            title: settingData[0]?.title,
            websiteSetting: settingData[0],
            senderName: getPrimary.firstName,
            content: "We are delighted to inform you that the reseller account for " + createdReseler.name + " has been created.",
            subject: "Reseller Account Created - " + createdReseler.name
        }

        // Send Email code here
        let mailing1 = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
        if (data.status) {
            for (let i = 0; i < saveMembers.length; i++) {
                if (saveMembers[i].status) {
                    let email = saveMembers[i].email
                    let userId = saveMembers[i]._id
                    let resetPasswordCode = randtoken.generate(4, '123456789')
                    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                    const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, {
                        link: resetLink, darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                        flag: "created",
                        subject: "Set Password",
                        title: settingData[0]?.title,
                        address: settingData[0]?.address, role: "Reseller", servicerName: saveMembers[i].firstName
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
        let count = await orderService.getOrdersCount();
        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "GC" + "2024" + data.unique_key_number
        data.unique_key = "GC-" + "2024-" + data.unique_key_number
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
            { termCondition: checkDealer?.termCondition },
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
        let IDs = await supportingFunction.getUserIds()
        let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.userId, isPrimary: true })
        IDs.push(getPrimary._id)
        let notificationData = {
            title: "New order created",
            description: "The new order " + savedResponse.unique_key + " has been created",
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
            content: "The new order " + savedResponse.unique_key + "  has been created for " + getPrimary.firstName + "",
            subject: "New Order"
        }


        let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary.email, notificationEmails, emailData))

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
        let serviceCoverage = '';
        if (req.body.serviceCoverageType == "Labour") {
            serviceCoverage = "Labor"
        }
        if (req.body.serviceCoverageType == "Parts & Labour") {
            serviceCoverage = "Parts & Labor"
        }
        data.serviceCoverageType = serviceCoverage != '' ? serviceCoverage : req.body.serviceCoverageType
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
        const obj = {
            customerId: checkOrder.customerId ? true : false,
            paymentStatus: checkOrder.paymentStatus == "Paid" ? true : false,
            coverageStartDate: resultArray.includes(true) ? false : true,
            fileName: isEmptyOrderFile.includes(true) ? false : true,
        };

        returnField.push(obj);

        //send notification to dealer,reseller,admin,customer
        let IDs = await supportingFunction.getUserIds()
        let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
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

        let settingData = await userService.getSetting({});

        let emailData = {
            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
            address: settingData[0]?.address,
            websiteSetting: settingData[0],
            senderName: dealerPrimary.firstName,
            content: "The  order " + checkOrder.unique_key + " has been updated",
            subject: "Order Updated"
        }

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
        if (obj.customerId && obj.paymentStatus && obj.coverageStartDate && obj.fileName) {
            let savedResponse = await orderService.updateOrder(
                { _id: req.params.orderId },
                { status: "Active" },
                { new: true }
            );
            var pricebookDetail = [];
            let dealerBookDetail = [];
            let count1 = await contractService.getContractsCountNew();
            var increamentNumber = count1[0]?.unique_key_number ? count1[0].unique_key_number + 1 : 100000
            let checkLength = savedResponse.productsArray.length - 1
            await savedResponse.productsArray.map(async (product, index) => {
                let contractArray = [];
                let getDealerPriceBookDetail = await dealerPriceService.getDealerPriceById({ dealerId: checkOrder.dealerId, priceBook: product.priceBookId })
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
                pricebookDetailObject.brokerFee = product.dealerPriceBookDetails.brokerFee
                pricebookDetailObject.dealerPriceId = product.dealerPriceBookDetails._id
                pricebookDetail.push(pricebookDetailObject)
                dealerBookDetail.push(dealerPriceBookObject)
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
                        partsWarranty: item[keys[5]],
                        labourWarranty: item[keys[6]],
                        purchaseDate: item[keys[7]],
                    };
                });
                totalDataComing.forEach((data, index) => {
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
                        return new Date(Math.min(new Date(d1).getTime(), new Date(d2).getTime(), new Date(d3).getTime()));

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
                        serviceCoverageType: serviceCoverage,
                        coverageType: req.body.coverageType,
                        serial: data.serial,
                        purchaseDate: new Date(data.purchaseDate),
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
                    let IDs = await supportingFunction.getUserIds()
                    let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.dealerId, isPrimary: true })
                    let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.customerId, isPrimary: true })
                    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: savedResponse.resellerId, isPrimary: true })
                    if (resellerPrimary) {
                        IDs.push(resellerPrimary._id)
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
                    let settingData = await userService.getSetting({});

                    let emailData = {
                        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                        address: settingData[0]?.address,
                        websiteSetting: settingData[0],
                        senderName: dealerPrimary.firstName,
                        content: "The  order " + savedResponse.unique_key + " has been updated and processed",
                        subject: "Process Order"
                    }
                    let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
                    //Email to Reseller

                    emailData = {
                        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                        address: settingData[0]?.address,
                        websiteSetting: settingData[0],
                        senderName: resellerPrimary?.firstName,
                        content: "The  order " + savedResponse.unique_key + " has been updated and processed",
                        subject: "Process Order"
                    }
                    mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
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

                    if (checkDealer?.termCondition) {
                        const tcResponse = await generateTC(savedResponse);
                    }

                    res.send({
                        code: constant.successCode,
                        message: "Success",
                    });
                }

            })
        } else {
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
        let websiteData = await supportingFunction.websiteSetting();
        const checkOrder = await orderService.getOrder({ _id: orderData._id }, { isDeleted: false })
        let coverageStartDate = checkOrder.productsArray[0]?.coverageStartDate;
        let coverageEndDate = checkOrder.productsArray[0]?.coverageEndDate;
        //Get Dealer
        const checkDealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: false })
        //Get customer
        const checkCustomer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: false })
        //Get customer primary info
        const customerUser = await userService.getUserById1({ metaId: checkOrder.customerId, isPrimary: true }, { isDeleted: false })

        const DealerUser = await userService.getUserById1({ metaId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false })

        const checkReseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: false })
        //Get reseller primary info
        const resellerUser = await userService.getUserById1({ metaId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false })
        //Get contract info of the order
        let productCoveredArray = []
        //Check contract is exist or not using contract id
        const contractArrayPromise = checkOrder?.productsArray.map(item => {
            if (!item.exit) return contractService.getContractById({
                orderProductId: item._id
            });
            else {
                return null;
            }
        })
        const contractArray = await Promise.all(contractArrayPromise);
        for (let i = 0; i < checkOrder?.productsArray.length; i++) {
            if (checkOrder?.productsArray[i].priceType == 'Quantity Pricing') {
                for (let j = 0; j < checkOrder?.productsArray[i].QuantityPricing.length; j++) {
                    let quanitityProduct = checkOrder?.productsArray[i].QuantityPricing[j];
                    let obj = {
                        productName: quanitityProduct.name,
                        noOfProducts: quanitityProduct.enterQuantity
                    }
                    productCoveredArray.push(obj)
                }

            }
            else {
                let findContract = contractArray.find(contract => contract.orderProductId.toString() === checkOrder?.productsArray[i]._id.toString())
                let obj = {
                    productName: findContract.productName,
                    noOfProducts: checkOrder?.productsArray[i].noOfProducts
                }
                productCoveredArray.push(obj)
            }

        }
        const tableRows = productCoveredArray.map(product => `
        <p style="font-size:13px;">${product.productName} : ${product.noOfProducts}</p>

`).join('');

        const checkServicer = await servicerService.getServiceProviderById({
            $or: [
                { "_id": checkOrder.servicerId },
                { "dealerId": checkOrder.servicerId },
                { "resellerId": checkOrder.servicerId }
            ]
        }, { isDeleted: false })

        const servicerUser = await userService.getUserById1({ metaId: checkOrder.servicerId, isPrimary: true }, { isDeleted: false })
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
        const orderFile = 'pdfs/' + mergeFileName;
        const html = `<head>
        <link rel="stylesheet" href="https://gistcdn.githack.com/mfd/09b70eb47474836f25a21660282ce0fd/raw/e06a670afcb2b861ed2ac4a1ef752d062ef6b46b/Gilroy.css"></link>
        </head>
        <table border='1' border-collapse='collapse' style=" border-collapse: collapse; font-size:13px;font-family:  'Gilroy', sans-serif;">
                            <tr>
                                <td style="width:50%; font-size:13px;padding:15px;">  ${websiteData[0].title} service contract number:</td>
                                <td style="font-size:13px;">${checkOrder.unique_key}</td>
                            </tr>
                            <tr>
                                <td style="font-size:13px;padding:15px;">${checkReseller ? "Reseller Name" : "Dealer Name"}:</td>
                                <td style="font-size:13px;"> 
                                    <p><b>Attention –</b> ${checkReseller ? checkReseller.name : checkDealer.name}</p>
                                    <p> <b>Email Address – </b>${resellerUser ? resellerUser?.email : DealerUser.email}</p>
                                    <p><b>Telephone :</b> +1 ${resellerUser ? resellerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : DealerUser.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3")}</p>
                                </td>
                            </tr>
                        <tr>
                            <td style="font-size:13px;padding:15px;"> ${websiteData[0].title}  service contract holder name:</td>
                            <td style="font-size:13px;">
                            <p> <b>Attention –</b>${checkCustomer ? checkCustomer?.username : ''}</p>
                            <p> <b>Email Address –</b>${checkCustomer ? customerUser?.email : ''}</p>
                            <p><b>Telephone :</b> +1${checkCustomer ? customerUser?.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3") : ''}</p>
                            </td>
                        </tr>
                    <tr>
                        <td style="font-size:13px;padding:15px;">Address of  ${websiteData[0].title}  service contract holder:</td>
                        <td style="font-size:13px;">
                        ${checkCustomer ? checkCustomer?.street : ''}, ${checkCustomer ? checkCustomer?.city : ''}, ${checkCustomer ? checkCustomer?.state : ''}, ${checkCustomer ? checkCustomer?.country : ''}</td>                
                          </tr>
                <tr>
                    <td style="font-size:13px;padding:15px;">Coverage Start Date:</td>
                    <td style="font-size:13px;"> ${moment(coverageStartDate).format("MM/DD/YYYY")}</td>
                </tr>
            <tr>
                <td style="font-size:13px;padding:15px;"> ${websiteData[0].title}  service contract period:</td>
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
            // -------------------merging pdfs 
            const { PDFDocument, rgb } = require('pdf-lib');
            const fs = require('fs').promises;

            async function mergePDFs(pdfPath1, pdfPath2, outputPath) {
                // Load the PDFs
                const pdfDoc1Bytes = await fs.readFile(pdfPath1);
                const pdfDoc2Bytes = await fs.readFile(pdfPath2);

                const pdfDoc1 = await PDFDocument.load(pdfDoc1Bytes);
                const pdfDoc2 = await PDFDocument.load(pdfDoc2Bytes);

                // Create a new PDF Document
                const mergedPdf = await PDFDocument.create();

                // Add the pages of the first PDF
                const pdfDoc1Pages = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
                pdfDoc1Pages.forEach((page) => mergedPdf.addPage(page));

                // Add the pages of the second PDF
                const pdfDoc2Pages = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
                pdfDoc2Pages.forEach((page) => mergedPdf.addPage(page));

                // Serialize the PDF
                const mergedPdfBytes = await mergedPdf.save();

                // Write the merged PDF to a file
                await fs.writeFile(outputPath, mergedPdfBytes);
            }

            const termConditionFile = checkOrder.termCondition.fileName ? checkOrder.termCondition.fileName : checkOrder.termCondition.filename
            // Usage
            const pdfPath2 = process.env.MAIN_FILE_PATH + orderFile;
            const pdfPath1 = process.env.MAIN_FILE_PATH + "uploads/" + termConditionFile;
            const outputPath = process.env.MAIN_FILE_PATH + "uploads/" + "mergedFile/" + mergeFileName;
            link = `${process.env.SITE_URL}:3002/uploads/" + "mergedFile/` + mergeFileName;
            let pathTosave = await mergePDFs(pdfPath1, pdfPath2, outputPath).catch(console.error);
            const pathToAttachment = process.env.MAIN_FILE_PATH + "/uploads/mergedFile/" + mergeFileName
            fs.readFile(pathToAttachment)
                .then(async (fileData) => {
                    const attachment = fileData.toString('base64');
                    try {
                        //sendTermAndCondition
                        // Send Email code here
                        let notificationEmails = await supportingFunction.getUserEmails();
                        notificationEmails.push(DealerUser.email)
                        notificationEmails.push(resellerUser?.email)
                        let settingData = await userService.getSetting({});
                        let emailData = {
                            darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
                            lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
                            address: settingData[0]?.address,
                            websiteSetting: settingData[0],
                            senderName: customerUser.firstName,
                            content: "Please read the following terms and conditions for your order. If you have any questions, feel free to reach out to our support team.",
                            subject: 'Order Term and Condition-' + checkOrder.unique_key,
                        }
                        let mailing = await sgMail.send(emailConstant.sendTermAndCondition(customerUser.email, notificationEmails, emailData, attachment))

                    } catch (error) {
                        console.error('Error sending email:', error);
                        if (error.response) {
                            console.error('Error response:', error.response.body);
                        }
                    }
                })
                .catch(err => {
                    console.error("Error reading the file:", err);
                });
        })
        return 1

    }
    catch (error) {
        console.error('Error :', error);
        if (error.response) {
            console.error('Error:', error.response.body);
        }
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
        let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'Open' })
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
        if (checkContract.productValue < claimTotal[0]?.amount) {
            res.send({
                code: consta.errorCode,
                message: 'Claim Amount Exceeds Contract Retail Price'
            });
            return;
        }
        data.receiptImage = data.file
        data.servicerId = data.servicerId ? data.servicerId : null
        let count = await claimService.getClaimCount();

        data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
        data.unique_key_search = "CC" + "2024" + data.unique_key_number
        data.unique_key = "CC-" + "2024-" + data.unique_key_number
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






