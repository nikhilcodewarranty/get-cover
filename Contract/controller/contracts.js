const { Contracts } = require("../model/contract");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const claimService = require("../../Claim/services/claimService");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const contract = require("../model/contract");
const providerService = require("../../Provider/services/providerService");

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
    if (data.dealerName) {
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
    if (data.customerName) {
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
    if (data.servicerName) {
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
    if (data.resellerName) {
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
      { $sort: { unique_key_number: -1 } },
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


    ]
    if (newQuery.length > 0) {
      myQuery = myQuery.concat(newQuery);
    }




    let getContracts = await contractService.getAllContracts2(myQuery)
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
    if (data.dealerName) {
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
    if (data.customerName) {
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
    if (data.servicerName) {
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
    if (data.resellerName) {
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
      { $sort: { unique_key_number: -1 } },
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


    ]
    if (newQuery.length > 0) {
      myQuery = myQuery.concat(newQuery);
    }




    let getContracts = await contractService.getAllContracts2(myQuery)
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
    let option = { new: true }
    let updateContracts = await contractService.updateContract(criteria, data, option)
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

    console.log("getData-------------------", getData)

    let orderProductId = getData[0].orderProductId
    let order = getData[0].order
    //res.json(order);return;
    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderProductId.toString())
      if (productsArray.length > 0) {
        productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
        getData[0].order[i].productsArray = productsArray
      }
    }
    getData.map((data, index) => {
      if (data.order[0]?.servicerId != null) {
        if (data.order[0]?.dealer[0]?.isServicer && data.order[0]?.dealerId.toString() === data.order[0]?.servicerId.toString()) {
          data.order[0]?.servicer.push(data.order[0]?.dealer[0])
          getData[index] = data
        }
        if (data.order[0]?.reseller.length > 0) {
          if (data.order[0]?.reseller[0]?.isServicer && data.order[0]?.resellerId.toString() === data.order[0]?.servicerId.toString()) {
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
    //   code: constant.successCode,
    //   result
    // })
    // return;
    let bulk = [];
    let contractIds = []
    let updateDoc;
    for (let i = 0; i < result.length; i++) {
      let contractId = result[i]._id;
      contractIds.push(contractId)
      let productValue = result[i].productValue;
      updateDoc = {
        'updateMany': {
          'filter': { '_id': contractId },
          update: { $set: { eligibilty: true } },
          'upsert': false
        }
      }
      bulk.push(updateDoc)
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