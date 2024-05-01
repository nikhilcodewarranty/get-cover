const { serviceProvider } = require("../model/serviceProvider");
const providerService = require("../services/providerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const role = require("../../User/model/role");
const userService = require("../../User/services/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const bcrypt = require("bcrypt");
const dealerService = require("../../Dealer/services/dealerService");
const mongoose = require('mongoose')
require("dotenv").config();

const randtoken = require('rand-token').generator()


exports.getServicerDetail = async (req, res) => {
    try {
        console.log(req.userId)
        let getMetaData = await userService.findOneUser({ _id: req.userId, isPrimary: true })
        if (!getMetaData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        };
        const singleServiceProvider = await providerService.getServiceProviderById({ _id: getMetaData.accountId });
        if (!singleServiceProvider) {
            res.send({
                code: constant.errorCode,
                message: "Invalid token"
            })
            return;
        };
        let resultUser = getMetaData.toObject()
        resultUser.meta = singleServiceProvider
        res.send({
            code: constant.successCode,
            message: resultUser
        })
    } catch (error) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicerUsers = async (req, res) => {
    try {
        let data = req.body
        // let getMetaData = await userService.findOneUser({ _id: req.userId })
        // if (!getMetaData) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Unable to fetch the details"
        //     })
        //     return;
        // };
        // console.log("check+++++++++++++++++++++", getMetaData)
        let getUsers = await userService.findUser({ accountId: req.userId }, { isPrimary: -1 })
        if (!getUsers) {
            res.send({
                code: constant.errorCode,
                message: "No Users Found!"
            })
        } else {
            const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
            const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
            const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
            const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
            const filteredData = getUsers.filter(entry => {
                return (
                    firstNameRegex.test(entry.firstName) &&
                    lastNameRegex.test(entry.lastName) &&
                    emailRegex.test(entry.email) &&
                    phoneRegex.test(entry.phoneNumber)
                );
            });
            // let getServicerStatus = await providerService.getServiceProviderById({ _id: req.params.servicerId }, { status: 1 })
            // if (!getServicerStatus) {
            //     res.send({
            //         code: constant.errorCode,
            //         message: "Invalid servicer ID"
            //     })
            //     return;
            // }
            res.send({
                code: constant.successCode,
                message: "Success",
                result: filteredData,
                // servicerStatus: getServicerStatus.status
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.changePrimaryUser = async (req, res) => {
    try {
        let data = req.body
        let checkUser = await userService.findOneUser({ _id: req.userId }, {})
        if (!checkUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to find the user"
            })
            return;
        };
        let updateLastPrimary = await userService.updateSingleUser({ accountId: checkUser.accountId, isPrimary: true }, { isPrimary: false }, { new: true })
        if (!updateLastPrimary) {
            res.send({
                code: constant.errorCode,
                message: "Unable to change tha primary"
            })
            return;
        };
        let updatePrimary = await userService.updateSingleUser({ _id: checkUser._id }, { isPrimary: true }, { new: true })
        if (!updatePrimary) {
            res.send({
                code: constant.errorCode,
                message: "Something went wrong"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "Updated successfully",
                result: updatePrimary
            })
        }

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.addServicerUser = async (req, res) => {
    try {
        let data = req.body
        let checkServicer = await providerService.getServicerByName({ _id: req.userId })
        console.log('cec--------------------------', req.userId, checkServicer)
        if (!checkServicer) {
            res.send({
                code: constant.errorCode,
                message: "invalid ID"
            })
            return;
        }
        let checkEmail = await userService.findOneUser({ email: data.email })
        if (checkEmail) {
            res.send({
                code: constant.errorCode,
                message: "user already exist with this email"
            })
            return;
        };
        data.isPrimary = false
        data.accountId = checkServicer._id
        let statusCheck;
        if (!checkServicer.accountStatus) {
            statusCheck = false
        } else {
            statusCheck = data.status
        }
        data.status = statusCheck
        data.roleId = "65719c8368a8a86ef8e1ae4d"
        console.log("check---------------------", data)
        let saveData = await userService.createUser(data)
        if (!saveData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to add the user"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Added successfully",
            result: saveData
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getUserId = async (req, res) => {
    try {
        let getUserDetail = await userService.getSingleUserByEmail({ _id: req.params.userId })
        if (!getUserDetail) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the user"
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Successfully fetched the user",
            result: getUserDetail
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.editUserDetail = async (req, res) => {
    try {
        let data = req.body
        let checkId = await userService.getSingleUserByEmail({ _id: req.params.userId })
        if (!checkId) {
            res.send({
                code: constant.errorCode,
                message: "Invalid user ID"
            })
            return;
        }
        let updateUser = await userService.updateUser({ _id: req.params.userId }, data, { new: true })
        if (!updateUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to update user"
            })
            return;
        };
        res.send({
            code: constant.successCode,
            message: "Successfully updated",
            result: updateUser
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicerContract = async (req, res) => {
    try {
        let data = req.body
        let getServicerOrder = await orderService.getOrders({ servicerId: req.params.servicerId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
        if (!getServicerOrder) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            })
            return
        }
        let orderIDs = getServicerOrder.map((ID) => ID._id)
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
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

                        // { $unwind: "$dealer" },
                        // { $unwind: "$reseller" },
                        // { $unwind: "$servicer?$servicer:{}" },

                    ]
                }
            },
            {
                $match: { isDeleted: false, orderId: { $in: orderIDs } },
            },
            // {
            //   $addFields: {
            //     contracts: {
            //       $slice: ["$contracts", skipLimit, limitData] // Replace skipValue and limitValue with your desired values
            //     }
            //   }
            // }
            // { $unwind: "$contracts" }
        ]
        console.log(pageLimit, skipLimit, limitData)
        let getContract = await contractService.getAllContracts(query, skipLimit, pageLimit)
        let totalCount = await contractService.findContracts({ isDeleted: false, orderId: { $in: orderIDs } })
        if (!getContract) {
            res.send({
                code: constants.errorCode,
                message: err.message
            })
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: getContract,
            totalCount: totalCount.length
        })

        console.log(orderIDs)
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicerDealers = async (req, res) => {
    try {
        let data = req.body
        let getDealersIds = await dealerRelationService.getDealerRelations({ servicerId: req.userId })
        if (!getDealersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the dealers"
            })
            return;
        };
        let ids = getDealersIds.map((item) => item.dealerId)
        let dealers = await dealerService.getAllDealers({ _id: { $in: ids } }, {})

        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };
        // return false;

        let dealarUser = await userService.getMembers({ accountId: { $in: ids }, isPrimary: true }, {})
        const result_Array = dealarUser.map(item1 => {
            const matchingItem = dealers.find(item2 => item2._id.toString() === item1.accountId.toString());

            if (matchingItem) {
                return {
                    ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    dealerData: matchingItem.toObject()
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
        const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber.replace(/\s+/g, ' ').trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.dealerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            data: filteredData
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
        let checkServicer = await providerService.getServicerByName({ _id: req.userId }, {})
        if (!checkServicer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid servicer ID"
            })
            return;
        }

        const trueArray = [];
        const falseArray = [];

        data.dealers.forEach(item => {
            if (item.status || item.status == "true") {
                trueArray.push(item);
            } else {
                falseArray.push(item);
            }
        });

        let uncheckId = falseArray.map(record => record._id)
        let checkId = trueArray.map(record => record._id)

        const existingRecords = await dealerRelationService.getDealerRelations({
            servicerId: new mongoose.Types.ObjectId(req.userId),
            dealerId: { $in: checkId }
        });

        // Step 2: Separate existing and non-existing servicer IDs
        const existingServicerIds = existingRecords.map(record => record.dealerId.toString());
        const newDealerIds = checkId.filter(id => !existingServicerIds.includes(id));


        // Step 3: Delete existing records
        let deleteExisted = await dealerRelationService.deleteRelations({
            servicerId: new mongoose.Types.ObjectId(req.userId),
            dealerId: { $in: uncheckId }
        });

        // Step 4: Insert new records
        const newRecords = newDealerIds.map(dealerId => ({
            servicerId: req.userId,
            dealerId: dealerId
        }));
        if (newRecords.length > 0) {

            let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
            res.send({
                code: constant.successCode,
                message: "success"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "success"
            })
        }

        // for (let i = 0; i < data.servicers.length; i++) {
        //   let servicer = data.servicers[i]
        //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.params.dealerId })
        //   if (!checkRelation) {

        //   } else {

        //   }
        // }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}