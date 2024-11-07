require("dotenv").config();
const userService = require("../../services/User/userService");
const dealerService = require('../../services/Dealer/dealerService')
const dealerPriceService = require('../../services/Dealer/dealerPriceService')
const priceBookService = require('../../services/PriceBook/priceBookService')
const providerService = require('../../services/Provider/providerService')
const users = require("../../models/User/users");
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

//Create Dealer by super admin
exports.createDealer = async (req, res) => {
    try {
        upload(req, res, async () => {
            const data = req.body;
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
                        'metaData.$.firstName':allUserData[0].firstNam,
                        'metaData.$.lastName':  allUserData[0].lastName,
                        'metaData.$.position':allUserData[0].position,
                        'metaData.$.phoneNumber':allUserData[0].phoneNumber,
                        'metaData.$.status':allUserData[0].status ? true : false,
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
                        isAccountCreate: isAccountCreate,
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
                let IDs = await supportingFunction.getUserIds()
                if (req.body.isAccountCreate) {
                    IDs.push(req.body.dealerId);
                }
                let notificationData = {
                    title: "Dealer Approval",
                    description: req.body.name + " " + "has been successfully approved",
                    userId: req.teammateId,
                    flag: 'dealer',
                    notificationFor: IDs
                };

                await userService.createNotification(notificationData);
                // Primary User Welcoime email
                let notificationEmails = await supportingFunction.getUserEmails();
                let emailData = {
                    senderName: loginUser.metaData[0]?.firstName,
                    content: "We are delighted to inform you that the dealer account for " + singleDealer.name + " has been approved.",
                    subject: "Dealer Account Approved - " + singleDealer.name
                }
                // Send Email code here
                sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))

                if (req.body.isAccountCreate) {
                    for (let i = 0; i < createUsers.length; i++) {
                        // Send mail to all User except primary
                        if (createUsers[i].status) {
                            let resetPasswordCode = randtoken.generate(4, '123456789')
                            let email = createUsers[i].email;
                            let userId = createUsers[i]._id;
                            let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                            sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                            await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                        }
                    }
                    // Send mail to  primary
                    let resetPrimaryCode = randtoken.generate(4, '123456789')
                    let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
                    sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { subject: "Set Password", link: resetPrimaryLink, role: req.role, dealerName: singleDealerUser.firstName }))
                    await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

                }
                if (req.body.isServicer) {
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

                let IDs = await supportingFunction.getUserIds()

                let notificationData = {
                    title: "Dealer Creation",
                    description: createMetaData.name + " " + "has been successfully created",
                    userId: req.teammateId,
                    flag: 'dealer',
                    notificationFor: IDs
                };
                let createNotification = await userService.createNotification(notificationData);
                // Create the user
                if (data.isServicer) {
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
                let notificationEmails = await supportingFunction.getUserEmails();

                let emailData = {
                    senderName: loginUser.metaData[0]?.firstName,
                    content: "We are delighted to inform you that the dealer account for " + createMetaData.name + " has been created.",
                    subject: "Dealer Account Created - " + createMetaData.name
                }

                sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['noreply@getcover.com'], emailData))
                // Send Email code here
                if (req.body.isAccountCreate) {
                    for (let i = 0; i < createUsers.length; i++) {
                        if (createUsers[i].status) {
                            let resetPasswordCode = randtoken.generate(4, '123456789')
                            let email = createUsers[i].email;
                            let userId = createUsers[i]._id;
                            let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                            let mailing = sgMail.send(emailConstant.dealerApproval(email, { subject: "Set Password", link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                            let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
                        }

                    }
                }
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
            let dataToUpdate = {
                $set: {
                    metaData: [{
                        metaId: findUser[0].metaId,
                        status: findUser[0].status,
                        roleId: findUser[0].roleId,
                        firstName: findUser[0].firstName,
                        lastName: findUser[0].lastName,
                        phoneNumber: findUser[0].phoneNumber,
                        position: findUser[0].position,
                        isPrimary: findUser[0].isPrimary,
                        isDeleted: findUser[0].isDeleted,
                        dialCode: findUser[0].dialCode
                    }]
                }
            }
            let updateUser = await userService.updateUser(dataToUpdate)
            console.log(updateUser, "==============================================================")
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