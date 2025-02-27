require("dotenv").config();
const userService = require("../../services/User/userService");
const dealerService = require('../../services/Dealer/dealerService')
const dealerPriceService = require('../../services/Dealer/dealerPriceService')
const priceBookService = require('../../services/PriceBook/priceBookService')
const providerService = require('../../services/Provider/providerService')
const users = require("../../models/User/users");
const maillogservice = require("../../services/User/maillogServices");
const reportingKeys = require("../../models/User/reportingKeys")
const role = require("../../models/User/role");
const logs = require('../../models/User/logs');
const setting = require("../../models/User/setting");
const constant = require('../../config/constant');
const supportingFunction = require('../../config/supportingFunction')
const emailConstant = require('../../config/emailConstant');
const bcrypt = require("bcrypt");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const csvParser = require('csv-parser');
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

const Storage = multerS3({
    s3: s3,
    bucket: process.env.bucket_name, // Ensure this environment variable is set
    metadata: (req, files, cb) => {
        cb(null, { fieldName: files.fieldname });
    },
    key: (req, files, cb) => {
        const fileName = files.fieldname + '-' + Date.now() + path.extname(files.originalname);
        cb(null, fileName);
    }
});

var upload = multer({
    storage: Storage,
}).any([
    { name: "file" },
    { name: "termCondition" },
])

const eligibilityService = require("../../services/Dealer/eligibilityService")
const fs = require('fs');
const { constants } = require("buffer");

exports.convertToBase64 = async (req, res) => {
    try {
        let data = req.body
        const filePath = path.join(__dirname, '..', '..', 'uploads', 'logo', data.logo);

        // Read the file synchronously
        const fileData = fs.readFileSync(filePath);

        // Convert the file data to a base64 string
        const base64String = fileData.toString('base64');

        // Send the base64 string in the response
        res.send({ base64: base64String });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//Create Dealer by super admin
exports.createDealer = async (req, res) => {
    try {
        upload(req, res, async () => {
            const data = req.body;
            data.name = data.name.trim().replace(/\s+/, ' ');
            const loginUser = await userService.getUserById1({ metaData: { $elemMatch: { metaId: req.userId, isPrimary: true } } }, {});
            //get coverage type based on dealer coverageType
            const coverageType = data.coverageType

            let priceFile
            let termFile;
            let isAccountCreate = req.body.isAccountCreate
            let file = req.files
            for (i = 0; i < file.length; i++) {
                if (file[i].fieldname == 'termCondition') {
                    termFile = file[i]
                    // termFile.push(file[i].filename);
                } else if (file[i].fieldname == 'file') {
                    priceFile = file[i]
                }
            }
            let termData = {
                fileName: termFile ? termFile.key : '',
                name: termFile ? termFile.originalname : '',
                size: termFile ? termFile.size : '',
            }
            // Check if the specified role exists
            const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
            if (!checkRole) {
                res.send({
                    code: constant.errorCode,
                    message: "Invalid role"
                });
                return;
            }
            const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
            const dealersUserData = data.dealers ? data.dealers : [];
            const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
            const uniqueEmails = new Set(allEmails);
            if (allEmails.length !== uniqueEmails.size) {
                res.send({
                    code: constant.errorCode,
                    message: 'Multiple user cannot have same email',
                });
                return
            }
            const base_url = `${process.env.SITE_URL}`
            let savePriceBookType = req.body.savePriceBookType
            const allUserData = [...dealersUserData, ...primaryUserData];
            if (data.dealerId != 'null' && data.dealerId != undefined) {
                let createUsers = [];
                if (data.email != data.oldEmail) {
                    let emailCheck = await userService.findOneUser({ email: data.email }, {});
                    if (emailCheck) {
                        res.send({
                            code: constant.errorCode,
                            message: "Primary user email already exist"
                        })
                        return;
                    }
                }
                if (data.name != data.oldName) {
                    let nameCheck = await dealerService.getDealerByName({ name: data.name });
                    if (nameCheck) {
                        res.send({
                            code: constant.errorCode,
                            message: "Dealer name already exist"
                        })
                        return;
                    }
                }
                const singleDealerUser = await userService.findOneUser({ metaData: { $elemMatch: { metaId: data.dealerId } } }, {});
                const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
                if (!singleDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: "Dealer Not found"
                    });
                    return;
                }

                // check uniqueness of dealer sku                  

                const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
                const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

                if (cleanStr1 !== cleanStr2) {
                    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
                    if (existingDealer) {
                        res.send({
                            code: constant.errorCode,
                            message: 'Dealer name already exists',
                        });
                        return
                    }
                }

                //Primary information edit
                let userQuery = { metaData: { $elemMatch: { metaId: { $in: [data.dealerId] }, isPrimary: true } } }


                let newValues1 = {
                    $set: {
                        email: allUserData[0].email,
                        'metaData.$.firstName': allUserData[0].firstNam,
                        'metaData.$.lastName': allUserData[0].lastName,
                        'metaData.$.position': allUserData[0].position,
                        'metaData.$.phoneNumber': allUserData[0].phoneNumber,
                        'metaData.$.status': allUserData[0].status ? true : false,
                        'metaData.$.roleId': "656f08041eb1acda244af8c6"

                    }

                }

                await userService.updateUser(userQuery, newValues1, { new: true })

                let allUsersData = allUserData.map((obj, index) => ({
                    ...obj,
                    metaData:
                        [
                            {
                                firstName: obj.firstName,
                                lastName: obj.lastName,
                                metaId: data.dealerId,
                                roleId: "656f08041eb1acda244af8c6",
                                position: obj.position,
                                dialCode: obj.dialCode,
                                status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
                                isPrimary: index === 0 ? true : false,
                            }
                        ],
                })
                );


                if (allUsersData.length > 1) {
                    allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
                    createUsers = await userService.insertManyUser(allUsersData);
                    if (!createUsers) {
                        res.send({
                            code: constant.errorCode,
                            message: "Unable to save users"
                        });
                        return;
                    }
                }


                let dealerQuery = { _id: data.dealerId }
                let newValues = {
                    $set: {
                        status: "Approved",
                        serviceCoverageType: req.body.serviceCoverageType,
                        isShippingAllowed: req.body.isShippingAllowed,
                        isAccountCreate: isAccountCreate,
                        coverageType: req.body.coverageType,
                        adhDays: req.body.adhDays,
                        termCondition: termData,
                        accountStatus: true,
                        userAccount: data.customerAccountCreated,
                        isServicer: data.isServicer ? data.isServicer : false
                    }
                }
                let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
                if (!dealerStatus) {
                    res.send({
                        code: constant.errorCode,
                        message: "Unable to approve dealer status"
                    });
                    return;
                }
                let eligibiltyData = {
                    userId: dealerStatus._id,
                    noOfClaimPerPeriod: data.noOfClaimPerPeriod,
                    noOfClaim: data.noOfClaim,
                    isManufacturerWarranty: data.isManufacturerWarranty
                }
                let createEligibility = await eligibilityService.createEligibility(eligibiltyData)
                if (!createEligibility._id) {
                    res.send({
                        code: constant.errorCode,
                        message: createEligibility.message
                    })
                    return
                }
                let statusUpdateCreateria = { metaData: { $elemMatch: { metaId: { $in: [data.dealerId] } } } }
                let updateData = {
                    $set: {
                        approvedStatus: 'Approved'
                    }
                }
                await userService.updateUser(statusUpdateCreateria, updateData, { new: true })
                // Send notification when approved
                const adminQuery = {
                    metaData: {
                        $elemMatch: {
                            roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
                            status: true,
                            "dealerNotifications.dealerAdded": true,
                        }
                    },

                }

                let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })

                const IDs = adminUsers.map(user => user._id)

                const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })

                let notificationData = {
                    title: "New Dealer Added",
                    description: `A New Dealer ${data.name} has been added and approved by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} on our portal.`,
                    userId: req.teammateId,
                    flag: 'dealer',
                    redirectionId: "dealerDetails/" + data.dealerId,
                    endPoint: base_url + "dealerDetails/" + data.dealerId,
                    notificationFor: IDs
                };
                await userService.createNotification(notificationData);
                // Primary User Welcoime email
                let notificationEmails = adminUsers.map(user => user.email)
                let emailData = {
                    senderName: loginUser.metaData[0]?.firstName,
                    content: "We are delighted to inform you that the dealer account for " + singleDealer.name + " has been approved.",
                    subject: "Dealer Account Approved - " + singleDealer.name,
                }
                let mailing;

                // Send Email code here
                if (notificationEmails.length > 0) {
                    mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
                    maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)
                }

                if (req.body.isAccountCreate) {
                    for (let i = 0; i < createUsers.length; i++) {
                        // Send mail to all User except primary
                        if (createUsers[i].metaData[0].status) {
                            let resetPasswordCode = randtoken.generate(4, '123456789')
                            let email = createUsers[i].email;
                            let userId = createUsers[i]._id;
                            let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                            mailing = await sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].metaData[0].firstName + " " + createUsers[i].metaData[0].lastName }))
                            let emailData = { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].metaData[0].firstName + " " + createUsers[i].metaData[0].lastName }
                            maillogservice.createMailLogFunction(mailing, emailData, [createUsers[i]], process.env.approval_mail)

                            await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                        }
                    }
                    // Send mail to  primary
                    let resetPrimaryCode = randtoken.generate(4, '123456789')
                    let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
                    mailing = await sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { subject: "Set Password", link: resetPrimaryLink, role: req.role, dealerName: singleDealerUser.firstName }))
                    maillogservice.createMailLogFunction(mailing, { subject: "Set Password", link: resetPrimaryLink, role: req.role, dealerName: singleDealerUser.firstName }, [singleDealerUser], process.env.approval_mail)

                    await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

                }
                if (req.body.isServicer && req.body.isServicer == "true") {
                    const CountServicer = await providerService.getServicerCount();
                    let servicerObject = {
                        name: data.name,
                        street: data.street,
                        city: data.city,
                        zip: data.zip,
                        dealerId: req.body.dealerId,
                        state: data.state,
                        country: data.country,
                        status: data.status,
                        accountStatus: "Approved",
                        unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                    }

                    let createData = await providerService.createServiceProvider(servicerObject)
                }
                // Save Setting for dealer
                const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
                let adminSetting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
                const settingData = {
                    logoLight: adminSetting[0]?.logoLight,
                    logoDark: adminSetting[0]?.logoDark,
                    favIcon: adminSetting[0]?.favIcon,
                    title: adminSetting[0]?.title,
                    colorScheme: adminSetting[0]?.colorScheme,
                    whiteLabelLogo: adminSetting[0]?.whiteLabelLogo,
                    address: adminSetting[0]?.address,
                    paymentDetail: adminSetting[0]?.paymentDetail,
                    setDefault: 0,
                    userId: req.body.dealerId,
                }
                const saveSetting = await userService.saveSetting(settingData)
                // Save Logs
                logData = {
                    userId: req.teammateId,
                    endpoint: "user/createDealer",
                    body: req.body,
                    response: {
                        code: constant.successCode,
                        message: 'New Dealer Created Successfully',
                    }
                }
                await logs(logData).save()
                res.send({
                    code: constant.successCode,
                    message: 'New Dealer Created Successfully',
                    result: dealerStatus
                });
                return;
            }
            else {
                const existingDealer = await dealerService.getDealerByName({ name: data.name }, { isDeleted: 0, __v: 0 });
                if (existingDealer) {
                    res.send({
                        code: constant.errorCode,
                        message: 'Dealer name already exists',
                    });
                    return
                }
                let emailCheck = await userService.findOneUser({ email: data.email }, {});
                if (emailCheck) {
                    res.send({
                        code: constant.errorCode,
                        message: "Primary user email already exist"
                    })
                    return;
                }

                let count = await dealerService.getDealerCount();

                const dealerMeta = {
                    name: data.name,
                    street: data.street,
                    userAccount: req.body.customerAccountCreated,
                    city: data.city,
                    serviceCoverageType: req.body.serviceCoverageType,
                    isShippingAllowed: req.body.isShippingAllowed,
                    coverageType: req.body.coverageType,
                    adhDays: req.body.adhDays,
                    isAccountCreate: req.body.isAccountCreate,
                    termCondition: termData,
                    zip: data.zip,
                    state: data.state,
                    isServicer: data.isServicer ? data.isServicer : false,
                    country: data.country,
                    status: 'Approved',
                    accountStatus: true,
                    createdBy: data.createdBy,
                    unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                };
                // Create Dealer Meta Data
                const createMetaData = await dealerService.createDealer(dealerMeta);
                if (!createMetaData) {
                    //Save Logs
                    let logData = {
                        userId: req.teammateId,
                        endpoint: "user/createDealer",
                        body: req.body,
                        response: {
                            code: constant.errorCode,
                            message: "Unable to create dealer"
                        }
                    }
                    await logs(logData).save()
                    res.send({
                        code: constant.errorCode,
                        message: "Unable to create dealer"
                    });
                    return;
                }
                let eligibiltyData = {
                    userId: createMetaData._id,
                    noOfClaimPerPeriod: data.noOfClaimPerPeriod,
                    noOfClaim: data.noOfClaim,
                    isManufacturerWarranty: data.isManufacturerWarranty
                }
                let createEligibility = await eligibilityService.createEligibility(eligibiltyData)
                if (!createEligibility._id) {
                    res.send({
                        code: constant.errorCode,
                        message: createEligibility.message
                    });
                    return;
                }
                //Save Logs
                let logData = {
                    userId: req.teammateId,
                    endpoint: "user/createDealer",
                    body: req.body,
                    response: {
                        code: constant.errorCode,
                        message: "New Dealer Created Successfully"
                    }
                }
                await logs(logData).save()
                //Send Notification to dealer 
                const adminQuery = {
                    metaData: {
                        $elemMatch: {
                            roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"),
                            status: true,
                            "dealerNotifications.dealerAdded": true,
                        }
                    },

                }

                let adminUsers = await supportingFunction.getNotificationEligibleUser(adminQuery, { email: 1, metaData: 1 })

                const IDs = adminUsers.map(user => user._id)

                const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })

                let notificationData = {
                    title: "New Dealer Added",
                    description: `A New Dealer ${createMetaData.name} has been added and approved by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName} on our portal.`,
                    userId: req.teammateId,
                    flag: 'dealer',
                    redirectionId: "dealerDetails/" + createMetaData._id,
                    endPoint: base_url + "dealerDetails/" + createMetaData._id,
                    notificationFor: IDs
                };
                let createNotification = await userService.createNotification(notificationData);

                console.log("sdffffffffdsdsddsddfs", typeof (data.isServicer))
                // Create the user
                if (data.isServicer && data.isServicer == "true") {
                    const CountServicer = await providerService.getServicerCount();
                    let servicerObject = {
                        name: data.name,
                        street: data.street,
                        city: data.city,
                        zip: data.zip,
                        dealerId: createMetaData._id,
                        state: data.state,
                        country: data.country,
                        status: data.status,
                        accountStatus: "Approved",
                        unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
                    }

                    let createData = await providerService.createServiceProvider(servicerObject)
                }

                let allUsersData = allUserData.map((obj, index) => ({
                    ...obj,
                    approvedStatus: 'Approved',
                    metaData:
                        [
                            {
                                firstName: obj.firstName,
                                lastName: obj.lastName,
                                phoneNumber: obj.phoneNumber,
                                metaId: createMetaData._id,
                                roleId: "656f08041eb1acda244af8c6",
                                position: obj.position,
                                dialCode: obj.dialCode,
                                status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
                                isPrimary: index === 0 ? true : false,
                            }
                        ],
                })
                );
                const createUsers = await userService.insertManyUser(allUsersData);
                if (!createUsers) {
                    res.send({
                        code: constant.errorCode,
                        message: "Unable to save users"
                    });
                    return;
                }

                //Approve status 
                let notificationEmails = adminUsers.map(user => user.email)

                let emailData = {
                    senderName: loginUser.metaData[0]?.firstName,
                    content: "We are delighted to inform you that the dealer account for " + createMetaData.name + " has been created.",
                    subject: "Dealer Account Created - " + createMetaData.name
                }
                let mailing;

                if (notificationEmails.length > 0) {
                    mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
                    maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

                }

                // Send Email code here
                if (req.body.isAccountCreate) {
                    for (let i = 0; i < createUsers.length; i++) {
                        if (createUsers[i]?.metaData[0]?.status) {
                            let resetPasswordCode = randtoken.generate(4, '123456789')
                            let email = createUsers[i].email;
                            let userId = createUsers[i]._id;
                            let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                            mailing = await sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].metaData[0].firstName + " " + createUsers[i].metaData[0].lastName }))
                            maillogservice.createMailLogFunction(mailing, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].metaData[0].firstName + " " + createUsers[i].metaData[0].lastName }, [createUsers[i]], process.env.approval_mail)
                            let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                        }

                    }
                }
                // Save Setting for dealer
                const checkUser = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin } } })
                let adminSetting = await userService.getSetting({ userId: checkUser.metaData[0].metaId });
                const settingData = {
                    logoLight: adminSetting[0]?.logoLight,
                    logoDark: adminSetting[0]?.logoDark,
                    favIcon: adminSetting[0]?.favIcon,
                    title: adminSetting[0]?.title,
                    colorScheme: adminSetting[0]?.colorScheme,
                    address: adminSetting[0]?.address,
                    whiteLabelLogo: adminSetting[0]?.whiteLabelLogo,
                    paymentDetail: adminSetting[0]?.paymentDetail,
                    setDefault: 0,
                    userId: createMetaData._id
                }
                const saveSetting = await userService.saveSetting(settingData)


                res.send({
                    code: constant.successCode,
                    message: 'New Dealer Created Successfully',
                    result: createMetaData
                });
                return;

            }

        })
    } catch (err) {
        //Save Logs
        let logData = {
            userId: req.teammateId,
            endpoint: "user/createDealer catch",
            body: req.body,
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await logs(logData).save()
        return res.send({
            code: constant.errorCode,
            message: err.message
        });

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
                    data: XLSX.utils.sheet_to_json(sheet, { defval: "" }),
                };

                resolve(result);
            }
        });
    });
};

//Create new service provider By SA
exports.createServiceProvider = async (req, res) => {
    try {
        const data = req.body;
        const providerUserArray = data.providers;
        // Find data by email
        const emailValues = providerUserArray.map(value => value.email);

        const userData = await userService.findByEmail(emailValues);

        if (userData) {
            return res.send({
                code: constant.errorCode,
                message: 'Email Already Exists',
                data: userData
            });
        }

        // Check if the specified role exists
        const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
        if (!checkRole) {
            return res.send({
                code: constant.errorCode,
                message: 'Invalid role',
            });
        }

        // Create a new provider meta data
        const providerMeta = {
            name: data.name,
            street: data.street,
            city: data.city,
            zip: data.zip,
            userAccount: req.body.customerAccountCreated,
            state: data.state,
            country: data.country,
            createdBy: data.createdBy,
        };

        // Create the service provider
        const createMetaData = await providerService.createServiceProvider(providerMeta);
        providerMeta.role = "Servicer"
        if (!createMetaData) {
            return res.send({
                code: constant.errorCode,
                message: 'Unable to create servicer account',
            });
        }

        // Remove duplicates
        const resultProvider = providerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
        const resultProviderData = accountCreationFlag
            ? await Promise.all(resultProvider.map(async (obj) => {
                const hashedPassword = await bcrypt.hash(obj.password, 10);
                return { ...obj, roleId: checkRole._id, metaId: createMetaData._id, status: true, password: hashedPassword };
            }))
            : await Promise.all(resultProvider.map(async (obj) => {
                const hashedPassword = await bcrypt.hash(obj.password, 10);
                return { ...obj, roleId: checkRole._id, metaId: createMetaData._id, password: hashedPassword };
            }));

        // Map provider data
        // Create provider users
        const createProviderUsers = await userService.insertManyUser(resultProviderData);
        if (!createProviderUsers) {
            return res.send({
                code: constant.errorCode,
                message: 'Unable to create users',
            });
        }

        return res.send({
            code: constant.successCode,
            message: 'Successfully Created',
        });

    } catch (err) {
        return res.send({
            code: constant.errorCode,
            message: err.message,
            data: createMetaData
        });
    }
};

exports.updateData = async (req, res) => {
    try {
        let findUser = await userService.findUser()
        for (let u = 0; u < findUser.length; u++) {
            findUser[u] = findUser[u].toObject()
            console.log(findUser[u], "++++++++++++++++", findUser[u].firstName)
            let dataToUpdate = {
                $set: {
                    metaData: [{
                        metaId: findUser[u].metaId ? findUser[u].metaId : findUser[u].metaData[0].metaId,
                        status: findUser[u].status ? findUser[u].status : findUser[u].metaData[0].status,
                        roleId: findUser[u].roleId ? findUser[u].roleId : findUser[u].metaData[0].roleId,
                        firstName: findUser[u].firstName ? findUser[u].firstName : findUser[u].metaData[0].firstName,
                        lastName: findUser[u].lastName ? findUser[u].lastName : findUser[u].metaData[0].lastName,
                        phoneNumber: findUser[u].phoneNumber ? findUser[u].phoneNumber : findUser[u].metaData[0].phoneNumber,
                        position: findUser[u].position ? findUser[u].position : findUser[u].metaData[0].position,
                        isPrimary: findUser[u].isPrimary ? findUser[u].isPrimary : findUser[u].metaData[0].isPrimary,
                        isDeleted: findUser[u].isDeleted ? findUser[u].isDeleted : findUser[u].metaData[0].isDeleted,
                        dialCode: findUser[u].dialCode ? findUser[u].dialCode : findUser[u].metaData[0].dialCode
                    }]
                }
            }
            let updateUser = await userService.updateUser({ _id: findUser[u]._id }, dataToUpdate, { new: true })
            // console.log(findUser[u],dataToUpdate.$set, "==============================================================")
        }
        res.send({
            code: 200
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message,
        })
    }
}

exports.getUserNotificationData = async (req, res) => {
    try {
        let data = req.body
        let getData = await userService.getUserById1({ _id: req.params.userId }, { metaData: 1 })
        if (!getData) {
            res.send({
                code: constant.errorCode,
                message: "User not found",
            })
            return
        }
        let metaData = getData.metaData[0]
        let newMetaData = JSON.parse(JSON.stringify(metaData));

        // if (req.role == "Dealer") {
        //     delete newMetaData.adminNotification.userAdded
        //     delete newMetaData.adminNotification.categoryUpdate
        //     delete newMetaData.adminNotification.priceBookUpdate
        //     delete newMetaData.adminNotification.priceBookAdd
        //     delete newMetaData.adminNotification.categoryAdded
        //     delete newMetaData.claimNotification.partsUpdate
        //     delete newMetaData.servicerNotification
        //     delete newMetaData.dealerNotifications.dealerAdded
        //     delete newMetaData.registerNotifications
        //     metaData = newMetaData

        // }
        // if (req.role == "Reseller") {
        //     delete newMetaData.claimNotification.partsUpdate
        //     delete newMetaData.servicerNotification
        //     delete newMetaData.dealerNotifications
        //     delete newMetaData.resellerNotifications.resellerAdded
        //     delete newMetaData.adminNotification
        //     delete newMetaData.registerNotifications
        //     metaData = newMetaData
        // }
        // if (req.role == "Customer") {
        //     delete newMetaData.adminNotification
        //     delete newMetaData.orderNotifications.addingNewOrderPending
        //     delete newMetaData.orderNotifications.updateOrderPending
        //     delete newMetaData.orderNotifications.archivinOrder
        //     delete newMetaData.claimNotification.partsUpdate
        //     delete newMetaData.customerNotifications.customerAdded
        //     delete newMetaData.servicerNotification
        //     delete newMetaData.dealerNotifications
        //     delete newMetaData.resellerNotifications
        //     delete newMetaData.registerNotifications
        //     metaData = newMetaData
        // }
        // if (req.role == "Servicer") {
        //     delete newMetaData.adminNotification.userAdded
        //     delete newMetaData.adminNotification.categoryUpdate
        //     delete newMetaData.adminNotification.priceBookUpdate
        //     delete newMetaData.adminNotification.priceBookAdd
        //     delete newMetaData.adminNotification.categoryAdded
        //     delete newMetaData.orderNotifications
        //     delete newMetaData.servicerNotification.servicerAdded
        //     delete newMetaData.dealerNotifications
        //     delete newMetaData.resellerNotifications
        //     delete newMetaData.registerNotifications
        //     delete newMetaData.customerNotifications
        //     metaData = newMetaData
        // }

        req.params.flag = req.params.flag ? req.params.flag : req.role

        if (req.params.flag == "Dealer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications.dealerAdded
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Reseller") {
            console.log("sldkslks")
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications.resellerAdded
            delete newMetaData.adminNotification
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Customer") {
            delete newMetaData.adminNotification
            delete newMetaData.orderNotifications.addingNewOrderPending
            delete newMetaData.orderNotifications.updateOrderPending
            delete newMetaData.orderNotifications.archivinOrder
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.customerNotifications.customerAdded
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Servicer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.orderNotifications
            delete newMetaData.servicerNotification.servicerAdded
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            delete newMetaData.customerNotifications
            metaData = newMetaData
        }

        res.send({
            code: constant.successCode,
            message: "Success",
            result: { notifications: metaData, _id: getData._id },
            result2: metaData
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.updateNotificationData = async (req, res) => {
    try {
        let data = req.body
        let getData = await userService.getUserById1({ _id: req.params.userId }, { metaData: 1 })
        console.log("--------------------------------", getData)
        if (!getData) {
            res.send({
                code: constant.errorCode,
                message: "User not found",
            })
            return
        }

        if (getData.metaData[0].roleId.toString() == "656f080e1eb1acda244af8c7") {
            req.params.flag = "Customer"
        }
        if (getData.metaData[0].roleId.toString() == "656f08041eb1acda244af8c6") {
            req.params.flag = "Dealer"
        }
        if (getData.metaData[0].roleId.toString() == "65719c8368a8a86ef8e1ae4d") {
            req.params.flag = "Servicer"
        }
        if (getData.metaData[0].roleId.toString() == "65bb94b4b68e5a4a62a0b563") {
            req.params.flag = "Reseller"
        }

        let updateData = {
            $set: {
                'metaData.$.orderNotifications': data.orderNotifications ? data.orderNotifications : getData.metaData[0].orderNotifications,
                'metaData.$.claimNotification': data.claimNotification ? data.claimNotification : getData.metaData[0].claimNotification,
                'metaData.$.adminNotification': data.adminNotification ? data.adminNotification : getData.metaData[0].adminNotification,
                'metaData.$.servicerNotification': data.servicerNotification ? data.servicerNotification : getData.metaData[0].servicerNotification,
                'metaData.$.dealerNotifications': data.dealerNotifications ? data.dealerNotifications : getData.metaData[0].dealerNotifications,
                'metaData.$.resellerNotifications': data.resellerNotifications ? data.resellerNotifications : getData.metaData[0].resellerNotifications,
                'metaData.$.customerNotifications': data.customerNotifications ? data.customerNotifications : getData.metaData[0].customerNotifications,
                'metaData.$.registerNotifications': data.registerNotifications ? data.registerNotifications : getData.metaData[0].registerNotifications,

            }
        }

        let updateUserData = await userService.updateSingleUser({ metaData: { $elemMatch: { metaId: getData.metaData[0].metaId } }, _id: req.params.userId }, updateData, { new: true })

        let metaData = updateUserData.metaData[0]
        let newMetaData = JSON.parse(JSON.stringify(metaData));

        if (req.role == "Dealer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications.dealerAdded
            delete newMetaData.registerNotifications
            metaData = newMetaData

        }
        if (req.role == "Reseller") {
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications.resellerAdded
            delete newMetaData.adminNotification
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.role == "Customer") {
            delete newMetaData.adminNotification
            delete newMetaData.orderNotifications.addingNewOrderPending
            delete newMetaData.orderNotifications.updateOrderPending
            delete newMetaData.orderNotifications.archivinOrder
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.customerNotifications.customerAdded
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.role == "Servicer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.orderNotifications
            delete newMetaData.servicerNotification.servicerAdded
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            delete newMetaData.customerNotifications
            metaData = newMetaData
        }

        if (req.params.flag == "Dealer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications.dealerAdded
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Reseller") {
            console.log("sldkslks")
            delete newMetaData.claimNotification.partsUpdate
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications.resellerAdded
            delete newMetaData.adminNotification
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Customer") {
            delete newMetaData.adminNotification
            delete newMetaData.orderNotifications.addingNewOrderPending
            delete newMetaData.orderNotifications.updateOrderPending
            delete newMetaData.orderNotifications.archivinOrder
            delete newMetaData.claimNotification.repairStatusUpdate
            delete newMetaData.customerNotifications.customerAdded
            delete newMetaData.servicerNotification
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            metaData = newMetaData
        }
        if (req.params.flag == "Servicer") {
            delete newMetaData.adminNotification.userAdded
            delete newMetaData.adminNotification.categoryUpdate
            delete newMetaData.adminNotification.priceBookUpdate
            delete newMetaData.adminNotification.priceBookAdd
            delete newMetaData.adminNotification.categoryAdded
            delete newMetaData.orderNotifications
            delete newMetaData.servicerNotification.servicerAdded
            delete newMetaData.dealerNotifications
            delete newMetaData.resellerNotifications
            delete newMetaData.registerNotifications
            delete newMetaData.customerNotifications
            metaData = newMetaData
        }

        if (!updateUserData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to update the data"
            })
            return
        }
        res.send({
            code: constant.successCode,
            message: "Successfully updated the data",
            result: { notifications: metaData, _id: updateUserData._id }
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.createReportingKeys = async (req, res) => {
    try {
        let data = req.body
        let checkUser = await userService.getUserById({ _id: req.userId })
        if (!checkUser) {
            res.send({
                code: constant.errorCode,
                message: "Invalid token"
            })
            return
        }
        data.userId = checkUser.metaData[0]._id
        let checkReporting = await reportingKeys.findOne({ userId: checkUser.metaData[0]._id })
        if (!checkReporting) {
            let updateData = await reportingKeys.findOneAndUpdate({ _id: checkReporting._id }, data, { new: true })
            if (!updateData) {
                res.send({
                    code: constant.errorCode,
                    message: "Unable to save the data"
                })
            } else {
                res.send({
                    code: constant.successCode,
                    message: "Success"
                })
            }
        } else {
            let saveData = await reportingKeys(data).save()

            if (!saveData) {
                res.send({
                    code: constant.errorCode,
                    message: "Unable to save the data"
                })
            } else {
                res.send({
                    code: constant.successCode,
                    message: "Success"
                })
            }
        }

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getReportingKeys = async (req, res) => {
    try {
        let getUser = await userService.getUserById1({ _id: req.userId })
        if (!getUser) {
            res.send({
                code: constant.errorCode,
                message: "Invalid token"
            })
            return
        }
        let getKeys = await reportingKeys.findOne({ userId: getUser.metaData[0]._id })
        res.send({
            code: constant.successCode,
            messsage: "Success",
            result: getKeys
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}