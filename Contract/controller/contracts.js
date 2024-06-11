const { Contracts } = require("../model/contract");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const claimService = require("../../Claim/services/claimService");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const contract = require("../model/contract");
const providerService = require("../../Provider/services/providerService");
const dealerService = require("../../Dealer/services/dealerService");
const customerService = require("../../Customer/services/customerService");
const resellerService = require("../../Dealer/services/resellerService");
const orderService = require("../../Order/services/orderService");

// get all contracts api

exports.getAllContracts = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)

    let contractFilter = []
    if (data.eligibilty != '') {
      contractFilter = [
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { eligibilty: data.eligibilty === "true" ? true : false },
      ]
    } else {
      contractFilter = [
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    }

    let newQuery = [];
    let matchedData = []
    if (data.dealerName != "") {
      newQuery.push(
        {
          $lookup: {
            from: "dealers",
            localField: "order.dealerId",
            foreignField: "_id",
            as: "order.dealer"
          }
        },
        // {
        //   $match: {
        //     $and: [
        //       { "order.dealer.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //     ]
        //   },
        // }
      );
      matchedData.push({ "order.dealer.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
    }
    if (data.customerName != "") {
      newQuery.push(
        {
          $lookup: {
            from: "dealers",
            localField: "order.dealerId",
            foreignField: "_id",
            as: "order.dealer"
          }
        },
        // {
        //   $match: {
        //     $and: [
        //       { "order.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //     ]
        //   },
        // }
      );
      matchedData.push({ "order.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
    }
    if (data.servicerName != "") {
      newQuery.push(
        {
          $lookup: {
            from: "serviceproviders",
            localField: "order.servicerId",
            foreignField: "_id",
            as: "order.servicer"
          }
        },
        // {
        //   $match: {
        //     $and: [
        //       { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //     ]
        //   },
        // }
      );
      matchedData.push({ "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
    }
    if (data.resellerName != "") {
      newQuery.push(
        {
          $lookup: {
            from: "resellers",
            localField: "order.resellerId",
            foreignField: "_id",
            as: "order.reseller"
          }
        },
        // {
        //   $match: {
        //     $and: [
        //       { "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //     ]
        //   },
        // }
      );
      matchedData.push({ "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
    }
    if (matchedData.length > 0) {
      let matchedCondition = {
        $match: {
          $and: matchedData
        }
      };
      newQuery.push(matchedCondition);
    }

    let queryWithLimit = {
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
              status: 1,
              minDate: 1,
              manufacture: 1,
              eligibilty: 1,
              order: {
                unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
                venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
              },
              totalRecords: 1
            }
          }
        ],
      },

    }

    newQuery.push(
      {
        $facet: {
          totalRecords: [
            {
              $count: "total"
            }
          ],
          data: [
            { $sort: { unique_key_number: -1 } },
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
                status: 1,
                minDate: 1,
                manufacture: 1,
                eligibilty: 1,
                order_unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
                order_venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
                order: {
                  unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
                  venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
                },
                totalRecords: 1
              }
            }
          ],
        },

      }

    )
    let myQuery = [
      {
        $match:
        {
          $and: contractFilter
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        }
      },
      {
        $match:
        {
          $and: [
            // {order: {$elemMatch: {venderOrder:  { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }}}},
            // {order: {$elemMatch: {unique_key:  { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }}}}
            { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // // { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      }

    ]
    if (newQuery.length > 0) {
      myQuery = myQuery.concat(newQuery);
    }


    console.log("------------------------------------", data);

    let getContracts = await contractService.getAllContracts2(myQuery)
    // console.log("+++++++++++++++++++++++++++++++++=", getContracts[0]?.data,getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0);
    let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      // result: myQuery,
      totalCount
      // count: getCo
    })

  } catch (err) {
    console.log(err)
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

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
      console.log("check on servicer ak-----------", getData)
      if (getData.length > 0) {
        servicerIds = await getData.map(servicer => servicer._id)
        let asServicer = await getData.map(servicer => {
          if (servicer.resellerId !== null && servicer.dealerId === null) {
            return servicer.resellerId;
          } else if (servicer.dealerId !== null && servicer.resellerId === null) {
            return servicer.dealerId;
          }
        })

        console.log("as servicer data +++++++++++++++++++++++++++++++++++", getData, asServicer)

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
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { eligibilty: data.eligibilty === "true" ? true : false },
      ]
    } else {
      contractFilterWithEligibilty = [
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
    console.log(orderIds)
    if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
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
                  minDate: 1,
                  status: 1,
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
        // {
        //   $lookup: {
        //     from: "orders",
        //     localField: "orderId",
        //     foreignField: "_id",
        //     as: "order",
        //   }
        // },
        // {
        //   $match:
        //   {
        //     $and: [
        //       { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //       // { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
        //       { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        //     ]
        //   },

        // }
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
                minDate: 1,
                unique_key: 1,
                status: 1,
                manufacture: 1,
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


    // console.log("sssssss", contractFilterWithPaging)

    let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

    let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
    console.log('sjdsjlfljksfklsjdf')
    for(let e=0;e<result1.length;e++){
      result1[e].reason = " "
      if(result1[e].status != "Active"){
        result1[e].reason = "Contract is not active"
      }
      if(result1[e].minDate < new Date()){
        result1[e].reason = "Contract will be eligible on 211221" + " " + result1[e].minDate
      }
      // let checkClaims = await claimService.getAllClaims()
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      result: result1,
      totalCount,
      mainQuery
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.editContract = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.contractId }
    const query = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotal = await claimService.checkTotalAmount(query);
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

// exports.getContractById = async (req, res) => {
//   try {
//     let data = req.body
//     let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//     let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//     let limitData = Number(pageLimit)
//     let query = [
//       {
//         $match: { _id: new mongoose.Types.ObjectId(req.params.contractId) },
//       },
//       {
//         $lookup: {
//           from: "orders",
//           localField: "orderId",
//           foreignField: "_id",
//           as: "order",
//           pipeline: [
//             {
//               $lookup: {
//                 from: "dealers",
//                 localField: "dealerId",
//                 foreignField: "_id",
//                 as: "dealer",
//               }
//             },
//             {
//               $lookup: {
//                 from: "resellers",
//                 localField: "resellerId",
//                 foreignField: "_id",
//                 as: "reseller",
//               }
//             },
//             {
//               $lookup: {
//                 from: "customers",
//                 localField: "customerId",
//                 foreignField: "_id",
//                 as: "customer",
//               }
//             },
//             {
//               $lookup: {
//                 from: "servicers",
//                 localField: "servicerId",
//                 foreignField: "_id",
//                 as: "servicer",
//               }
//             },

//           ],

//         }
//       },
//     ]
//     let getData = await contractService.getContracts(query, skipLimit, pageLimit)
//     // let orderId = getData[0].orderProductId
//     // let order = getData[0].order
//     // for (let i = 0; i < order.length; i++) {
//     //   console.log(orderId)
//     //  const productsArray = order[i].productsArray.filter(product => product._id.toString() == orderId.toString())
//     //  console.log(productsArray)
//     // }

//     // console.log(getData);

//     if (!getData) {
//       res.send({
//         code: constant.errorCode,
//         message: "Unable to get contract"
//       })
//       return;
//     }
//     res.send({
//       code: constant.successCode,
//       message: "Success",
//       result: getData[0]
//     })
//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }

exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotal = await claimService.checkTotalAmount(totalCreteria);
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
    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }
    let orderProductId = getData[0].orderProductId
    let order = getData[0].order
    // res.json(order);return;
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

exports.cronJobEligible = async (req, res) => {
  try {
    let query = { status: 'Active' };
    // let claimQuery = { 'claims.claimStatus': 'Open' };
    let data = req.body;

    let lookupQuery = [
      {
        $match: query // Your match condition here
      },
      {
        $lookup: {
          from: "claims",
          localField: "_id",
          foreignField: "contractId",
          as: "claims"
        }
      },
      // {
      //   $match: claimQuery // Your match condition here
      // },
      {
        $sort: { unique_key: -1 } // Sorting if required
      },
    ];
    let result = await contractService.getAllContracts2(lookupQuery);

    // res.send({
    //   result
    // })
    // return;
    let bulk = [];
    let contractIds = []
    let contractIdsToBeUpdate = []
    let contractIdToBeUpdate;
    let updateDoc;
    for (let i = 0; i < result.length; i++) {
      let product = result[i];
      let dateCheck = new Date(product.coverageStartDate)
      let adhDays = Number(product.adh ? product.adh : 0)
      let partWarrantyMonth = Number(product.partsWarranty ? product.partsWarranty : 0)
      let labourWarrantyMonth = Number(product.labourWarranty ? product.labourWarranty : 0)
      dateCheck = dateCheck.setDate(dateCheck.getDate() + adhDays)
      let p_date = new Date(product.purchaseDate)
      let l_date = new Date(product.purchaseDate)
      let l_date1 = new Date(product.purchaseDate)
      let p_date1 = new Date(product.purchaseDate)
      let purchaseMonth = p_date.getMonth();
      let monthsPart = partWarrantyMonth;
      let newPartMonth = purchaseMonth + monthsPart;
      let monthsLabour = labourWarrantyMonth;
      let newLabourMonth = purchaseMonth + monthsLabour;
      let partsWarrantyDate = new Date(p_date.setMonth(newPartMonth))
      let partsWarrantyDate1 = new Date(p_date1.setMonth(newPartMonth))
      let labourWarrantyDate = new Date(l_date.setMonth(newLabourMonth))
      let labourWarrantyDate1 = new Date(l_date1.setMonth(newLabourMonth))
      let checkDate = new Date(dateCheck);
      let partsWarantyCheck = new Date(partsWarrantyDate);
      let labourWarrantyCheck = new Date(labourWarrantyDate);
      //    let minDate = new Date(Math.min(checkDate.getTime(), partsWarantyCheck.getTime(), labourWarrantyCheck.getTime()))
      let contractId = result[i]._id;
      function findMinDate(d1, d2, d3) {
        return new Date(Math.min(d1.getTime(), d2.getTime(), d3.getTime()));
      }
      // Find the minimum date
      let minDate;
      if (product.coverageType == "Breakdown") {
        if (product.serviceCoverageType == "Labour") {

          minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

          // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
          // }
          // else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
          // }

        } else if (product.serviceCoverageType == "Parts") {

          minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));


          // if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
          // } else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
          // }

        } else {

          minDate = findMinDate(new Date(dateCheck.setMonth(100000)), new Date(partsWarrantyDate), new Date(labourWarrantyDate));


          // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

          // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

          // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

          // } else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
          // }
        }
      } else if (product.coverageType == "Accidental") {
        minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

        // if (req.body.serviceCoverageType == "Labour") {
        //     if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

        //     } else {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
        //     }

        // } else if (req.body.serviceCoverageType == "Parts") {
        //     if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
        //     } else {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
        //     }

        // } else {
        //     if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

        //     } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

        //     } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

        //     } else {
        //         minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
        //     }
        // }
      } else {
        if (product.serviceCoverageType == "Labour") {
          minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

          // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck).setHours(0, 0, 0, 0), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
          // }
          // else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));
          // }

        } else if (product.serviceCoverageType == "Parts") {
          minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

          // if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));
          // } else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));
          // }

        } else {
          minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));

          // if (new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(partsWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate.setMonth(100000)));

          // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate));

          // } else if (new Date(partsWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && new Date(labourWarrantyDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate.setMonth(100000)), new Date(labourWarrantyDate.setMonth(100000)));

          // } else {
          //     minDate = findMinDate(new Date(dateCheck), new Date(partsWarrantyDate), new Date(labourWarrantyDate));
          // }
        }
      }

      // let eligibilty = new Date(dateCheck) < new Date() ? true : false
      let eligibilty = new Date(minDate) < new Date() ? true : false
      //let productValue = result[i].productValue;
      if (eligibilty) {
        contractIds.push(contractId)
        updateDoc = {
          'updateMany': {
            'filter': { '_id': contractId },
            update: { $set: { eligibilty: eligibilty } },
            'upsert': false
          }
        }
        bulk.push(updateDoc)
      }
      else {
        updateDoc = {
          'updateMany': {
            'filter': { '_id': contractId },
            update: { $set: { eligibilty: false } },
            'upsert': false
          }
        }
        bulk.push(updateDoc)
      }
    }
    // Update when not any claim right now for active contract
    const firstUpdate = await contractService.allUpdate(bulk);
    bulk = [];
    let checkClaim = await claimService.getClaims({ contractId: { $in: contractIds } })
    const openContractIds = checkClaim.filter(claim => claim.claimFile === 'Open').map(claim => claim.contractId);
    let updateDocument = openContractIds.map((openContract) => {
      updateDoc = {
        'updateMany': {
          'filter': { '_id': openContract },
          update: { $set: { eligibilty: false } },
          'upsert': false
        }
      }
      bulk.push(updateDoc)
    })
    // Update when claim is open for contract
    const update = await contractService.allUpdate(bulk);
    bulk = [];
    //const updatedData = await contractService.allUpdate(bulk);
    const notOpenContractIds = checkClaim.filter(claim => claim.claimFile !== 'Open').map(claim => claim.contractId);
    if (notOpenContractIds.length > 0) {
      for (let j = 0; j < notOpenContractIds.length; j++) {
        let claimTotal = await claimService.checkTotalAmount({ contractId: new mongoose.Types.ObjectId(notOpenContractIds[j]) });
        let obj = result.filter(el => el._id.toString() === notOpenContractIds[j].toString())
        if (obj[0]?.productValue > claimTotal[0]?.amount) {
          updateDoc = {
            'updateMany': {
              'filter': { '_id': notOpenContractIds[j] },
              update: { $set: { eligibilty: true } },
              'upsert': false
            }
          }
          bulk.push(updateDoc)
        }
        else {
          updateDoc = {
            'updateMany': {
              'filter': { '_id': notOpenContractIds[j] },
              update: { $set: { eligibilty: false } },
              'upsert': false
            }
          }
          bulk.push(updateDoc)
        }
      }
    }
    // Update when claim is not open but completed claim and product value still less than claim value
    const updatedData1 = await contractService.allUpdate(bulk);
    res.send({
      code: constant.successCode,
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}