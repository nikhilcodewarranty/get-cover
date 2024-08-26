require("dotenv").config();
const contract = require("../../models/Contract/contract");
const contractService = require("../../services/Contract/contractService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const claimService = require("../../services/Claim/claimService");
const providerService = require("../../services/Provider/providerService");
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

    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
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
                  pName: 1,
                  model: 1,
                  serial: 1,
                  unique_key: 1,
                  minDate: 1,
                  status: 1,
                  productValue: 1,
                  manufacture: 1,
                  eligibilty: 1,
                  orderUniqueKey: 1,
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
                pName: 1,
                model: 1,
                serial: 1,
                minDate: 1,
                unique_key: 1,
                status: 1,
                manufacture: 1,
                productValue: 1,
                eligibilty: 1,
                orderUniqueKey: 1,
                venderOrder: 1,
                totalRecords: 1
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
                  if: { $eq: ["$claimFile", "Open"] }, // Assuming "claimFile" field is correct
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
    let checkClaim = await claimService.getClaims({ contractId: req.params.contractId, claimFile: "Open" })

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
                  if: { $eq: ["$claimFile", "Open"] }, // Assuming "claimFile" field is correct
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
      result: getData[0]
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
      const openContractIds = checkClaim.filter(claim => claim.claimFile === 'Open').map(claim => claim.contractId);

      openContractIds.forEach(openContract => {
        bulk.push({
          'updateMany': {
            'filter': { '_id': openContract },
            'update': { $set: { eligibilty: false } },
            'upsert': false
          }
        });
      });

      // Update when claim is open for contract
      await contractService.allUpdate(bulk);
      bulk = [];

      const notOpenContractIds = checkClaim.filter(claim => claim.claimFile !== 'Open').map(claim => claim.contractId);

      if (notOpenContractIds.length > 0) {
        for (let j = 0; j < notOpenContractIds.length; j++) {
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
          } else {
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

