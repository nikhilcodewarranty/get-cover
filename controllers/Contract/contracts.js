require("dotenv").config();
const contract = require("../../models/Contract/contract");
const contractService = require("../../services/Contract/contractService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const claimService = require("../../services/Claim/claimService");
const providerService = require("../../services/Provider/providerService");
const userService = require("../../services/User/userService");
const dealerService = require("../../services/Dealer/dealerService");
const customerService = require("../../services/Customer/customerService");
const resellerService = require("../../services/Dealer/resellerService");
const orderService = require("../../services/Order/orderService");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");


//Get all contracts new api
exports.getContracts = async (req, res) => {
  try {
    let data = req.body
    let getTheThresholdLimir = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 0
    if (data.dealerName != "") {
      userSearchCheck = 1
      let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        dealerIds = await getData.map(dealer => dealer._id)
      } else {
        dealerIds.push("1111121ccf9d400000000000")
      }
    };

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

    if (data.resellerName != "") {
      userSearchCheck = 1
      let getData = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        resellerIds = await getData.map(servicer => servicer._id)
      } else {
        resellerIds.push("1111121ccf9d400000000000")
      }
    };

    let orderAndCondition = []

    if (dealerIds.length > 0) {
      orderAndCondition.push({ dealerId: { $in: dealerIds } })
    }
    if (customerIds.length > 0) {
      orderAndCondition.push({ customerId: { $in: customerIds } })

    }
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })

    }
    if (resellerIds.length > 0) {
      orderAndCondition.push({ resellerId: { $in: resellerIds } })

    }

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
        { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { eligibilty: data.eligibilty === "true" ? true : false },
      ]
    } else {
      contractFilterWithEligibilty = [
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { dealerSku: { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
      endDate.setHours(11, 59, 0, 0)
      let dateFilter = { createdAt: { $gte: startDate, $lte: endDate } }
      contractFilterWithEligibilty.push(dateFilter)
    }

    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.dealerSku === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        // let dateFilter = { createdAt: { $gte: data.startDate, $lte: data.endDate } }
        // {
        //   $match: {
        //     createdAt: { $gte: data.startDate, $lte: data.endDate }
        //   }
        // },
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
                  pName: 1,
                  model: 1,
                  serial: 1,
                  dealerSku: 1,
                  unique_key: 1,
                  claimAmount: 1,
                  minDate: 1,
                  status: 1,
                  productValue: 1,
                  manufacture: 1,
                  eligibilty: 1,
                  orderUniqueKey: 1,
                  venderOrder: 1,
                  totalRecords: 1,
                  createdAt: 1
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
                pName: 1,
                model: 1,
                serial: 1,
                minDate: 1,
                unique_key: 1,
                dealerSku: 1,
                status: 1,
                claimAmount: 1,
                manufacture: 1,
                productValue: 1,
                eligibilty: 1,
                orderUniqueKey: 1,
                venderOrder: 1,
                totalRecords: 1,
                createdAt: 1
              }
            }
          ],
        },

      })
    }

    let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
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
        if (checkClaims[0].totalAmount >= result1[e].productValue) {
          result1[e].reason = "Claim value exceed the product value limit"
        }
      }

      let thresholdLimitPercentage = getTheThresholdLimir.threshHoldLimit.value
      const thresholdLimitValue = (thresholdLimitPercentage / 100) * Number(result1[e].productValue);
      let overThreshold = result1[e].claimAmount > thresholdLimitValue;
      let threshHoldMessage = "This claim amount surpasses the maximum allowed threshold."
      if (!overThreshold) {
        threshHoldMessage = ""
      }
      if (!getTheThresholdLimir.isThreshHoldLimit) {
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

//edit claim
exports.editContract = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.contractId }
    const query = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]

    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    const claimAmount = claimTotal[0]?.amount ? claimTotal[0]?.amount : 0
    let option = { new: true }
    //check claim
    let checkClaim = await claimService.getClaims({ contractId: req.params.contractId, claimFile: "open" })

    if (!checkClaim[0]) {
      if (claimAmount < data.productValue) {
        data.eligibilty = true
      }
    }

    if (claimAmount > data.productValue || claimAmount == data.productValue) {
      data.eligibilty = false
    }
    let updateContracts = await contractService.updateContract(criteria, data, option)
    //check if claim value is less then product value update eligibilty true

    if (!updateContracts) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the contract"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Successfully updated the contract",
      result: updateContracts
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getContractClaims = async (req, res) => {
  try {
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    let match1 = {};
    let servicerMatch = {}
    let dealerMatch = {}
    let resellerMatch = {}
    let dateMatch = {}
    // checking the user type from token
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      match = { servicerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (req.role == 'Reseller') {
      match = { resellerId: new mongoose.Types.ObjectId(req.userId) }
    }

    if (data.flag == "dealer") {
      match1 = { dealerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "reseller") {
      match1 = { resellerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "servicer") {
      match1 = { servicerId: new mongoose.Types.ObjectId(data.userId) }

    }
    if (data.flag == "customer") {
      match1 = { customerId: new mongoose.Types.ObjectId(data.userId) }

    }

    const query = { contractId: new mongoose.Types.ObjectId(data.contractId) }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]

    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    // building the query for claims
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
            $project: {
              "contractId": 1,
              "totalAmount": {
                "$sum": {
                  "$filter": {
                    "input": "$score",
                    "as": "s",
                    "cond": { "$eq": ["$$s.claimFile", "completed"] }
                  }
                }
              },
              "claimFile": 1,
              "lossDate": 1,
              submittedBy: 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              dealerSku: 1,
              customerStatus: 1,
              trackingNumber: 1,
              claimPaymentStatus: 1,
              trackingType: 1,
              getcoverOverAmount: 1,
              customerOverAmount: 1,
              customerClaimAmount: 1,
              getCoverClaimAmount: 1,
              claimType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.productValue": 1,
              "contracts.claimAmount": 1,
              "contracts.coverageType": 1,
              "contracts.model": 1,
              "contracts.pName": 1,
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
              "contracts.orders.dealers.accountStatus": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              "contracts.orders.customer._id": 1,
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
    data.servicerName = data.servicerName ? data.servicerName : ""
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
    data.resellerName = data.resellerName ? data.resellerName : ""
    data.dateFilter = data.dateFilter ? data.dateFilter : ""
    if (data.dealerName != "") {
      let getDealer = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } }, { _id: 1 })
      let dealerIds = getDealer.map(ID => new mongoose.Types.ObjectId(ID._id))
      dealerMatch = { dealerId: { $in: dealerIds } }

    }

    if (data.resellerName != "") {
      let getReseller = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName : '', '$options': 'i' } }, { _id: 1 })
      let resellerIds = getReseller.map(ID => new mongoose.Types.ObjectId(ID._id))
      resellerMatch = { resellerId: { $in: resellerIds } }

    }

    statusMatch = {}
    if (data.dateFilter != "") {
      let newEndDate = new Date(data.endDate)
      newEndDate.setHours(23, 59, 59, 999);
      if (data.dateFilter == "damageDate") {
        dateMatch = { lossDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "openDate") {
        dateMatch = { createdAt: { $gte: new Date(data.startDate), $lte: newEndDate } }
        // statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
      if (data.dateFilter == "closeDate") {
        dateMatch = { claimDate: { $gte: new Date(data.startDate), $lte: newEndDate } }
        statusMatch = { "claimStatus.status": { $in: ["completed", "rejected"] } }
      }
    }

    let claimPaidStatus = {}
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
      { $sort: { createdAt: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            claimPaidStatus,
            { contractId: new mongoose.Types.ObjectId(req.params.contractId) },
            { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'dealerSku': { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            servicerMatch,
            dealerMatch,
            resellerMatch,
            dateMatch,
            statusMatch,
            match1
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
            { "contracts.orders.isDeleted": false },
            match
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
        $match:
        {
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
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
    // res.json(allClaims);
    // return;
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
    //service call from claim services
    let allServicer = await providerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })



    let result_Array = resultFiter.map((item1) => {
      servicer = []
      let mergedData = []


      let servicerName = ''
      let selfServicer = false;
      let selfResellerServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
        if (dealerOfServicer) {
          servicer.push(dealerOfServicer)
        }
      });

      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }

      if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
        servicer.unshift(item1.contracts.orders.resellers[0])
      }

      if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
        servicer.unshift(item1.contracts.orders.dealers)
      }

      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer?._id?.toString() === item1.servicerId?.toString());
        selfServicer = req.role == "Customer" ? false : item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
        selfResellerServicer = item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString()
      }


      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        if (req.role == "Servicer") {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else if (req.role == "Dealer" && selfServicer) {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else if (req.role == "Reseller" && selfResellerServicer) {
          // Show coverage type without theft and lost coverage type
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value && contract.value != 'theft_and_lost')
          );
        }
        else {
          mergedData = dynamicOption.value.filter(contract =>
            item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
          );
        }

      }

      return {
        ...item1,
        servicerData: servicerName,
        selfResellerServicer: selfResellerServicer,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer,
          mergedData: mergedData
        }
      }
    })

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0 // getting the total count 
    let getTheThresholdLimit = await userService.getUserById1({ metaData: { $elemMatch: { roleId: process.env.super_admin, isPrimary: true } } })
    result_Array = await Promise.all(
      result_Array.map(async (claimObject) => {
        const { productValue, claimAmount } = claimObject.contracts;
        let query;
        claimObject.contracts.orders.customer.username = claimObject.contracts.orders.customer.username
        if (req.role == "Customer") {
          if (claimObject?.submittedBy != '') {
            query = { email: claimObject?.submittedBy }
          }
          else {
            query = { metaData: { $elemMatch: { metaId: claimObject.contracts.orders.customerId, isPrimary: true } } }
          }
          const customerDetail = await userService.getUserById1(query)

          claimObject.contracts.orders.customer.username = customerDetail?.metaData[0]?.firstName + " " + customerDetail?.metaData[0]?.lastName
        }

        // Simulate an async operation if needed (e.g., fetching data)
        const thresholdLimitValue = (getTheThresholdLimit?.threshHoldLimit?.value / 100) * productValue;

        // Check if claimAmount exceeds the threshold limit value
        let overThreshold = claimAmount > thresholdLimitValue;
        let threshHoldMessage = "Claim amount exceeds the allowed limit. This might lead to claim rejection. To proceed further with claim please contact admin.";
        if (!overThreshold) {
          threshHoldMessage = "";
        }
        if (claimObject.claimStatus.status === "rejected") {
          threshHoldMessage = "";
        }
        if (!getTheThresholdLimit.isThreshHoldLimit) {
          overThreshold = false;
          threshHoldMessage = "";
        }

        // Return the updated object with the new key 'overThreshold'
        return {
          ...claimObject,
          overThreshold,
          threshHoldMessage,
        };
      })
    );



    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount,
      claimTotal
    });

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
//Get single contract
exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: totalCreteria },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }
    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    let totalClaim = await claimService.findContractCount({ contractId: new mongoose.Types.ObjectId(req.params.contractId) })


    let query = [
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.contractId) },
      },
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
                from: "serviceproviders",
                localField: "servicerId",
                foreignField: "_id",
                as: "servicer",
              }
            },

          ],

        }
      },
    ]
    let getData = await contractService.getContracts(query, skipLimit, pageLimit)

    for (let e = 0; e < getData.length; e++) {
      getData[e].reason = " "

      if (getData[e].status != "Active") {
        getData[e].reason = "Contract is not active"
      }

      if (new Date(getData[e].minDate) > new Date()) {
        const options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        const formattedDate = new Date(getData[e].minDate).toLocaleDateString('en-US', options)
        getData[e].reason = "Contract will be eligible on " + " " + formattedDate
      }

      let claimQuery = [
        {
          $match: { contractId: new mongoose.Types.ObjectId(getData[e]._id) }
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
          getData[e].reason = "Contract has open claim"

        }
        if (checkClaims[0].totalAmount >= getData[e].productValue) {
          getData[e].reason = "Claim value exceed the product value limit"
        }
      }
    }

    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }
    let orderProductId = getData[0].orderProductId
    let order = getData[0].order

    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id?.toString() == orderProductId?.toString())

      if (productsArray.length > 0) {
        productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
        getData[0].order[i].productsArray = productsArray
      }

    }
    getData.map((data, index) => {

      if (data.order[0]?.servicerId != null) {
        if (data.order[0]?.dealer[0]?.isServicer && data.order[0]?.dealerId?.toString() === data.order[0]?.servicerId?.toString()) {
          data.order[0]?.servicer.push(data.order[0]?.dealer[0])
          getData[index] = data
        }

        if (data.order[0]?.reseller.length > 0) {
          if (data.order[0]?.reseller[0]?.isServicer && data.order[0]?.resellerId?.toString() === data.order[0]?.servicerId?.toString()) {
            data.order[0]?.servicer.push(data.order[0]?.reseller[0])
            getData[index] = data
          }

        }
      }
    })

    //Get dynamic options
    const dynamicOption = await userService.getOptions({ name: "coverage_type" })
    getData[0].mergedData = [];
    getData[0].adhDays.forEach(adhItem => {
      const matchedOption = dynamicOption.value.find(option => option.value === adhItem.value);

      if (matchedOption) {
        getData[0].mergedData.push({
          label: matchedOption.label,
          value: adhItem.value,
          waitingDays: adhItem.waitingDays,
          deductible: adhItem.deductible,
          amountType: adhItem.amountType
        });
      }
    });
    getData[0].totalClaim = totalClaim
    if (!getData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get contract"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getData[0],
      totalClaim
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message + ":" + err.stack
    })
  }
}

//Delete Bulk Contract
exports.deleteOrdercontractbulk = async (req, res) => {
  try {
    let deleteContract = await contract.deleteMany({ orderId: "65d86f0372b2ed718d3271b1" })
    res.send({
      code: constant.successCode,
      message: "Success",
      result: deleteContract
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Cron Job for Eligible 
exports.cronJobEligible = async (req, res) => {
  try {
    const query = { status: 'Active' };
    const limit = 10000; // Adjust the limit based on your needs
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await contractService.findContracts2(query, limit, page);

      if (result.length === 0) {
        hasMore = false;
        break;
      }

      let bulk = [];
      let contractIds = [];
      let contractIdsToBeUpdate = [];
      let contractIdToBeUpdate;
      let updateDoc;
      for (let i = 0; i < result.length; i++) {
        let product = result[i];
        let contractId = product._id;
        let check = new Date() >= new Date(product.minDate) && new Date() <= new Date(product.coverageEndDate) ? true : false
        if (new Date() >= new Date(product.minDate) && new Date() <= new Date(product.coverageEndDate)) {
          contractIds.push(product._id);
          updateDoc = {
            'updateMany': {
              'filter': { '_id': contractId },
              'update': { $set: { eligibilty: true } },
              'upsert': false
            }
          };
        } else {
          updateDoc = {
            'updateMany': {
              'filter': { '_id': contractId },
              'update': { $set: { eligibilty: false } },
              'upsert': false
            }
          };
        }
        bulk.push(updateDoc);
      }


      // Update when not any claim right now for active contract
      await contractService.allUpdate(bulk);
      bulk = [];
      // Fetch claims for contracts
      let checkClaim = await claimService.getClaims({ contractId: { $in: contractIds } });
      const openContractIds = checkClaim.filter(claim => claim.claimFile === 'open').map(claim => claim.contractId);

      openContractIds.forEach(openContract => {
        // console.log("openContract",openContract)
        bulk.push({
          'updateMany': {
            'filter': { '_id': openContract },
            'update': { $set: { eligibilty: false } },
            'upsert': false
          }
        });
      });

      // console.log("bulk00000000000000000000000",bulk)
      // Update when claim is open for contract
      await contractService.allUpdate(bulk);
      bulk = [];

      const notOpenContractIds = checkClaim.filter(claim => claim.claimFile !== 'open').map(claim => claim.contractId);

      if (notOpenContractIds.length > 0) {
        for (let j = 0; j < notOpenContractIds.length; j++) {
          if (!openContractIds.some(item => item.equals(notOpenContractIds[j]))) {
            let claimTotalQuery = [
              { $match: { contractId: new mongoose.Types.ObjectId(notOpenContractIds[j]) } },
              { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

            ]
            let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
            let obj = result.find(el => el._id.toString() === notOpenContractIds[j].toString());
            if (obj?.productValue > claimTotal[0]?.amount) {
              bulk.push({
                'updateMany': {
                  'filter': { '_id': notOpenContractIds[j] },
                  'update': { $set: { eligibilty: true } },
                  'upsert': false
                }
              });
            }
          }

          else {
            bulk.push({
              'updateMany': {
                'filter': { '_id': notOpenContractIds[j] },
                'update': { $set: { eligibilty: false } },
                'upsert': false
              }
            });
          }
        }
      }

      // Update when claim is not open but completed claim and product value still less than claim value
      await contractService.allUpdate(bulk);
      page++;
    }

    res.send({
      code: constant.successCode,
    });

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// have to do
exports.updateContract = async (req, res) => {
  try {
    let getOrder = await orderService.getOrder({ _id: "66fa6ffe1d16062766365aae" })
    let contractObject = {
      $set: {
        coverageStartDate1: getOrder.productsArray[0].coverageStartDate,
        coverageEndDate1: getOrder.productsArray[0].coverageEndDate
      }
    }
    let updateMany = await contractService.updateManyContract({ orderId: getOrder._id }, contractObject, { new: true })
    res.send({
      updateMany
    })
  } catch (err) {
    res.send({
      code: 401,
      message: err.statck
    })
  }
}

