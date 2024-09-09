require("dotenv").config()
const { serviceProvider } = require("../../models/Provider/serviceProvider");
const role = require("../../models/User/role");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const reportingController = require('../../controllers/User/reportingController')
const providerService = require("../../services/Provider/providerService");
const dealerRelationService = require("../../services/Dealer/dealerRelationService");
const claimService = require("../../services/Claim/claimService");
const userService = require("../../services/User/userService");
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService");
const resellerService = require("../../services/Dealer/resellerService");
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.sendgrid_key);
const bcrypt = require("bcrypt");
const mongoose = require('mongoose');


//get servicer detail
exports.getServicerDetail = async (req, res) => {
    try {
        let getMetaData = await userService.findOneUser({ _id: req.teammateId })
        if (!getMetaData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        };
        const singleServiceProvider = await providerService.getServiceProviderById({ _id: getMetaData.metaId });
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

//get servicer user
exports.getServicerUsers = async (req, res) => {
    try {
        let data = req.body
        let getUsers = await userService.findUser({ metaId: req.userId }, { isPrimary: -1 })
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
            res.send({
                code: constant.successCode,
                message: "Success",
                result: filteredData,
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//change primary user
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
        let updateLastPrimary = await userService.updateSingleUser({ metaId: checkUser.metaId, isPrimary: true }, { isPrimary: false }, { new: true })

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

//add servicer user
exports.addServicerUser = async (req, res) => {
    try {
        let data = req.body
        let checkServicer = await providerService.getServicerByName({ _id: req.userId })
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
        data.metaId = checkServicer._id
        let statusCheck;
        if (!checkServicer.accountStatus) {
            statusCheck = false
        } else {
            statusCheck = data.status
        }
        data.status = statusCheck
        data.roleId = "65719c8368a8a86ef8e1ae4d"
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

//get user by id
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

//edit user detail
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

//get servicer contract
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
                    ]
                }
            },
            {
                $match: { isDeleted: false, orderId: { $in: orderIDs } },
            },
        ]
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

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//get dealer of servicer
exports.getServicerDealers = async (req, res) => {
    try {
        let data = req.body
        let query = [
            {
                $match: {
                    servicerId: new mongoose.Types.ObjectId(req.userId)
                }
            },
            {
                $lookup: {
                    from: "dealers",
                    localField: "dealerId",
                    foreignField: "_id",
                    as: "dealerData",
                    pipeline: [
                        {
                            $match: {
                                "name": { '$regex': data.name ? data.name : '', '$options': 'i' },
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "_id",
                                foreignField: "metaId",
                                as: "userData",
                                pipeline: [
                                    {
                                        $match: {
                                            isPrimary: true,
                                            "email": { '$regex': data.email ? data.email : '', '$options': 'i' },
                                            "phoneNumber": { '$regex': data.phone ? data.phone : '', '$options': 'i' },
                                        }
                                    }
                                ]
                            }
                        },
                        { $unwind: "$userData" },
                        {
                            $lookup: {
                                from: "claims",
                                localField: "_id",
                                foreignField: "dealerId",
                                as: "claimsData",
                                pipeline: [
                                    {
                                        $match: {
                                            servicerId: new mongoose.Types.ObjectId(req.userId),
                                            claimFile: "Completed"

                                        }
                                    },
                                    {
                                        $group: {
                                            _id: { servicerId: new mongoose.Types.ObjectId(req.userId) },
                                            totalAmount: { $sum: "$totalAmount" },
                                            numberOfClaims: { $sum: 1 }
                                        }
                                    },
                                    {
                                        $project: {
                                            _id: 0,
                                            totalAmount: 1,
                                            numberOfClaims: 1
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$dealerData"
            },
        ]

        let filteredData = await dealerRelationService.getDealerRelationsAggregate(query)
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

//create Relation with dealer
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
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//get dashboard data
exports.getDashboardData = async (req, res) => {
    try {
        const claimQuery = { claimFile: 'Completed', servicerId: new mongoose.Types.ObjectId(req.userId) }
        //Get claims data
        let lookupQuery = [
            {
                $match: claimQuery
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
        //Get number of claims
        let numberOfCompleletedClaims = [
            {
                $match: claimQuery
            },
        ]
        let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);

        const paidClaimQuery = { claimFile: 'Completed', servicerId: new mongoose.Types.ObjectId(req.userId), claimPaymentStatus: "Paid" }
        //Get total paid claim value
        let paidLookUp = [
            {
                $match: paidClaimQuery
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
        let paidClaimValue = await claimService.getClaimWithAggregate(paidLookUp);
        const unPaidClaimQuery = { claimFile: 'Completed', servicerId: new mongoose.Types.ObjectId(req.userId), claimPaymentStatus: "Unpaid" }
        //Get total Unpaid claim value
        let unPaidLookUp = [
            {
                $match: unPaidClaimQuery
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
        let unPaidClaimValue = await claimService.getClaimWithAggregate(unPaidLookUp);
        const claimData = {
            numberOfClaims: numberOfClaims.length,
            valueClaim: valueClaim.length > 0 ? valueClaim[0]?.totalAmount : 0,
            paidClaimValue: paidClaimValue.length > 0 ? paidClaimValue[0]?.totalAmount : 0,
            unPaidClaimValue: unPaidClaimValue.length > 0 ? unPaidClaimValue[0]?.totalAmount : 0,
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: {
                claimData: claimData,
            }
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//get sales reporting
exports.saleReporting = async (req, res) => {
    try {
        let bodyData = req.body
        bodyData.servicerId = req.userId
        bodyData.role = req.role
        bodyData.returnValue = {
            total_broker_fee: 1,
            total_admin_fee: 1,
            total_fronting_fee: 1,
            total_reserve_future_fee: 1,
            total_contracts: 1,
            total_reinsurance_fee: 1,
            wholesale_price: 1
        };

        if (req.body.flag == "daily") {
            let sales = await reportingController.dailySales1(bodyData)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: sales
            })
        } else if (req.body.flag == "weekly") {

            let sales = await reportingController.weeklySales(bodyData)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: sales
            })
        } else if (req.body.flag == "day") {

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

//get cliam reporting
exports.claimReporting = async (req, res) => {
    try {
        let data = req.body
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

        if (data.flag == "daily") {
            data.servicerId = req.userId
            let claim = await reportingController.claimDailyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim
            })
        } else if (data.flag == "weekly") {
            data.servicerId = req.userId
            let claim = await reportingController.claimWeeklyReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim
            })
        } else if (data.flag == "day") {
            data.servicerId = req.userId
            let claim = await reportingController.claimDayReporting(data)
            res.send({
                code: constant.successCode,
                message: "Success",
                result: claim
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//get dropdown for claim
exports.claimReportinDropdown = async (req, res) => {
    try {
        let data = req.body
        let result;
        let query = [
            {
                $match: {
                    servicerId: new mongoose.Types.ObjectId(req.userId)
                }
            },
            {
                $lookup: {
                    from: "dealers",
                    localField: "dealerId",
                    foreignField: "_id",
                    as: "dealerData",
                }
            },
            {
                $unwind: "$dealerData"
            },
            {
                $project: {
                    "dealerData": 1,
                    'name': "$dealerData.name",
                    '_id': "$dealerData._id",
                }
            }

        ]
        let filteredData = await dealerRelationService.getDealerRelationsAggregate(query)
        let dealerIds = filteredData.map(ID => ID.dealerData._id)
        let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: { $in: dealerIds } })
        let priceBookIds = getDealerBooks.map(ID => ID.priceBook)
        filteredData = {
            dealers: filteredData.map(dealer => {
                return {
                    _id: dealer.dealerData._id,
                    name: dealer.dealerData.name
                };
            })
        };
        let getDealers = filteredData.dealers
        let getServicer = await providerService.getAllServiceProvider({ accountStatus: "Approved", dealerId: null, resellerId: null })
        let getPriceBooks = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } }, { _id: 1, name: 1, pName: 1, coverageType: 1, category: 1 })
        let cateId = getPriceBooks.map(ID => ID.category)
        let getCategories = await priceBookService.getAllPriceCat({ _id: { $in: cateId } }, { name: 1, _id: 1 })
        result = {
            dealers: getDealers,
            priceBooks: getPriceBooks,
            categories: getCategories
        }

        if (data.primary == "dealer") {
            if (data.dealerId != "") {
                let getDealerBooks = await dealerPriceService.findAllDealerPrice({ dealerId: data.dealerId })
                let priceBookIds = getDealerBooks?.map(ID => ID.priceBook)
                let getPriceBooks1 = await priceBookService.getAllPriceIds({ _id: { $in: priceBookIds } })
                let categoriesIds = getPriceBooks1?.map(ID => ID.category)
                let getCategories1 = await priceBookService.getAllPriceCat({ _id: { $in: categoriesIds } })

                if (data.categoryId != "") {
                    getPriceBooks1 = getPriceBooks1.filter(book => book.category.toString() === data.categoryId.toString());
                }

                if (data.priceBookId.length != 0 && data.categoryId == "") {
                    getCategories1 = []
                }

                result = {
                    dealers: getDealers,
                    priceBooks: getPriceBooks1,
                    categories: getCategories1
                }
            } else {
                result = {
                    dealers: getDealers,
                    priceBooks: [],
                    categories: []
                }
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
                dealers: [],
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
            message: err.stack
        })
    }
};

//get dashboard data for graph
exports.getDashboardGraph = async (req, res) => {
    try {
        let data = req.body
        let endOfMonth1s = new Date();
        let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));
        let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));
        let startOfMonths = new Date(startOfMonth2s.getFullYear(), startOfMonth2s.getMonth(), startOfMonth2s.getDate());
        let startOfMonth1s = new Date(startOfYear2s.getFullYear(), startOfYear2s.getMonth(), startOfYear2s.getDate());
        let endOfMonths = new Date(endOfMonth1s.getFullYear(), endOfMonth1s.getMonth(), endOfMonth1s.getDate() + 1);
        let orderQuery = [
            {
                $match: {
                    updatedAt: { $gte: startOfMonths, $lte: endOfMonths },
                    status: "Active"

                }
            },
            {
                $unwind: "$productsArray"
            },
            {
                $group: {
                    _id: "$productsArray.priceBookDetails.name",
                    totalPrice: { $sum: "$productsArray.price" },
                }
            },
            {
                $project: {
                    _id: 0,
                    priceBookName: "$_id",
                    totalPrice: 1,
                    term: 1,

                }
            },
            {
                $sort: { totalPrice: -1 }
            }

        ]

        let orderQuery1 = [
            {
                $match: {
                    updatedAt: { $gte: startOfMonth1s, $lte: endOfMonths },
                    status: "Active"
                }
            },
            {
                $unwind: "$productsArray"
            },
            {
                $group: {
                    _id: "$productsArray.priceBookDetails.name",
                    totalPrice: { $sum: "$productsArray.price" }
                }
            },
            {
                $project: {
                    _id: 0,
                    priceBookName: "$_id",
                    totalPrice: 1
                }
            },
            {
                $sort: { totalPrice: -1 }
            }

        ]

        let endOfMonth1 = new Date();
        let startOfMonth2 = new Date(new Date().setDate(new Date().getDate() - 30));
        let startOfMonth = new Date(startOfMonth2.getFullYear(), startOfMonth2.getMonth(), startOfMonth2.getDate());
        let endOfMonth = new Date(endOfMonth1.getFullYear(), endOfMonth1.getMonth(), endOfMonth1.getDate() + 1);

        if (isNaN(startOfMonth) || isNaN(endOfMonth)) {
            return { code: 401, message: "invalid date" };
        }

        let datesArray = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            datesArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let dailyQuery = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    servicerId: new mongoose.Types.ObjectId(req.userId),
                    claimStatus: {
                        $elemMatch: { status: "Completed" }
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total_amount: { $sum: "$totalAmount" },
                    total_claim: { $sum: 1 },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let dailyQuery1 = [
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
                    status: "Active"
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    order_amount: { $sum: "$orderAmount" },
                    total_order: { $sum: 1 },
                }
            },
            {
                $sort: { _id: 1 } // Sort by date in ascending order
            }
        ];

        let getData = await claimService.getClaimWithAggregate(dailyQuery)
        let getData2 = await orderService.getAllOrders1(dailyQuery1)
        let getOrders = await orderService.getAllOrders1(orderQuery)
        let getOrders1 = await orderService.getAllOrders1(orderQuery1)
        let priceBookNames = getOrders.map(ID => ID.priceBookName)
        let priceBookName1 = getOrders1.map(ID => ID.priceBookName)
        let priceQuery = {
            name: { $in: priceBookNames }
        }

        let priceQuery1 = {
            name: { $in: priceBookName1 }
        }
        let getPriceBooks = await priceBookService.getAllActivePriceBook(priceQuery)
        let getPriceBooks1 = await priceBookService.getAllActivePriceBook(priceQuery1)
        const result = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                total_amount: order ? order.total_amount : 0,
                total_claim: order ? order.total_claim : 0,

            };
        });
        const result1 = datesArray.map(date => {
            const dateString = date.toISOString().slice(0, 10);
            const order = getData2.find(item => item._id === dateString);
            return {
                weekStart: dateString,
                order_amount: order ? order.order_amount : 0,
                total_order: order ? order.total_order : 0,
            };
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            claim_result: result,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

//get dashboard info
exports.getDashboardInfo = async (req, res) => {

    let query = [
        {
            $match: {
                servicerId: new mongoose.Types.ObjectId(req.userId)
            }
        }
    ]
    let getRelations = await dealerRelationService.getDealerRelationsAggregate(query)
    let dealerIds = getRelations.map(ID => new mongoose.Types.ObjectId(ID.dealerId))

    let orderQuery = [
        {
            $match: { status: "Active" }
        },
        {
            "$addFields": {
                "noOfProducts": {
                    "$sum": "$productsArray.checkNumberProducts"
                },
                totalOrderAmount: { $sum: "$orderAmount" },

            }
        },
        { $sort: { unique_key: -1 } }]
    const lastFiveOrder = await orderService.getOrderWithContract(orderQuery, 5, 5)
    const claimQuery = [
        {
            $match: {
                $and: [
                    { servicerId: new mongoose.Types.ObjectId(req.userId) },
                    { claimFile: "Completed" }
                ]
            }
        },
        {
            $sort: {
                unique_key_number: -1
            }
        },
        {
            $limit: 5
        },
        {
            $lookup: {
                from: "contracts",
                localField: "contractId",
                foreignField: "_id",
                as: "contract"
            }
        },
        {
            $unwind: "$contract"
        },
        {
            $project: {
                unique_key: 1,
                "contract.unique_key": 1,
                unique_key_number: 1,
                totalAmount: 1
            }
        },
    ]
    const getLastNumberOfClaims = await claimService.getClaimWithAggregate(claimQuery, {})
    let lookupQuery = [
        {
            $match: { _id: { $in: dealerIds } }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "metaId",
                as: "users",
                pipeline: [
                    {
                        $match: {
                            isPrimary: true
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "dealerId",
                as: "order",
                pipeline: [
                    {
                        $match: { status: "Active" }
                    },
                    {
                        "$group": {
                            _id: "$order.dealerId",
                            "totalOrder": { "$sum": 1 },
                            "totalAmount": {
                                "$sum": "$orderAmount"
                            }
                        }
                    },
                ]
            }
        },
        {
            $lookup: {
                from: "claims",
                localField: "_id",
                foreignField: "dealerId",
                as: "claim",
                pipeline: [
                    {
                        $match: { status: "Active" }
                    },
                    {
                        "$group": {
                            _id: "$order.dealerId",
                            "totalClaim": { "$sum": 1 },
                            "claimAmount": {
                                "$sum": "$totalAmount"
                            }
                        }
                    },
                ]
            }
        },
        {
            $project: {
                name: 1,
                totalAmount: {
                    $cond: {
                        if: { $gte: [{ $arrayElemAt: ["$order.totalAmount", 0] }, 0] },
                        then: { $arrayElemAt: ["$order.totalAmount", 0] },
                        else: 0
                    }
                },
                totalOrder: {
                    $cond: {
                        if: { $gt: [{ $arrayElemAt: ["$order.totalOrder", 0] }, 0] },
                        then: { $arrayElemAt: ["$order.totalOrder", 0] },
                        else: 0
                    }
                },
                claimAmount: {
                    $cond: {
                        if: { $gte: [{ $arrayElemAt: ["$claims.claimAmount", 0] }, 0] },
                        then: { $arrayElemAt: ["$claims.claimAmount", 0] },
                        else: 0
                    }
                },
                totalClaim: {
                    $cond: {
                        if: { $gt: [{ $arrayElemAt: ["$claims.totalClaim", 0] }, 0] },
                        then: { $arrayElemAt: ["$claims.totalClaim", 0] },
                        else: 0
                    }
                },
                'phone': { $arrayElemAt: ["$users.phoneNumber", 0] },

            }
        },

        { "$sort": { totalAmount: -1 } },
        { "$limit": 5 }  // Apply limit again after sorting
    ]

    const topFiveDealer = await dealerService.getTopFiveDealers(lookupQuery);
    let lookupClaim = [
        {
            $match: {
                dealerId: null,
                resellerId: null
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "metaId",
                as: "users",
                pipeline: [
                    {
                        $match: {
                            isPrimary: true
                        }
                    }
                ]
            }
        },

        {
            $lookup: {
                from: "claims",
                localField: "_id",
                foreignField: "servicerId",
                as: "claims",
                pipeline: [
                    {
                        $match: { claimFile: "Completed" }
                    },
                    {
                        "$group": {
                            _id: "$servicerId",
                            "totalClaim": { "$sum": 1 },
                            "totalClaimAmount": {
                                "$sum": "$totalAmount"
                            }
                        }
                    },
                ]
            }
        },
        {
            $project: {
                name: 1,
                totalClaimAmount: {
                    $cond: {
                        if: { $gte: [{ $arrayElemAt: ["$claims.totalClaimAmount", 0] }, 0] },
                        then: { $arrayElemAt: ["$claims.totalClaimAmount", 0] },
                        else: 0
                    }
                },
                totalClaim: {
                    $cond: {
                        if: { $gt: [{ $arrayElemAt: ["$claims.totalClaim", 0] }, 0] },
                        then: { $arrayElemAt: ["$claims.totalClaim", 0] },
                        else: 0
                    }
                },
                'phone': { $arrayElemAt: ["$users.phoneNumber", 0] },

            }
        },

        { "$sort": { totalClaimAmount: -1 } },
        { "$limit": 5 }  // Apply limit again after sorting
    ]
    const topFiveServicer = await providerService.getTopFiveServicer(lookupClaim);
    const result = {
        lastFiveClaims: getLastNumberOfClaims,
        topFiveDealer: topFiveDealer,
    }
    res.send({
        code: constant.successCode,
        result: result
    })
}