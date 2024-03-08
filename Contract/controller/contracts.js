const { Contracts } = require("../model/contract");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const claimService = require("../../Claim/services/claimService");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const contract = require("../model/contract");

// get all contracts api

exports.getAllContracts = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let newQuery = [];
    if(data.contractId){
      newQuery.push({
        
      })
    }
    let query = [
      // { $sort: { unique_key_number: -1 } },
      {

        $match:
        {
          $and: [
            { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { productName: { $regex: `^${data.productName ? data.productName : ''}` } },
            { serial: { $regex: `^${data.serial ? data.serial : ''}` } },
            { manufacture: { $regex: `^${data.manufacture ? data.manufacture : ''}` } },
            { model: { $regex: `^${data.model ? data.model : ''}` } },
            { status: { $regex: `^${data.status ? data.status : ''}` } },
            // { eligibility: true },
          ]
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
        $unwind: {
          path: "$order",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $match:
        {
          $and: [
            { "order.venderOrder": { $regex: `^${data.venderOrder ? data.venderOrder : ''}` } },
            { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
          ]
        },
        
      },
      {
        $lookup: {
          from: "dealers",
          localField: "order.dealerId",
          foreignField: "_id",
          as: "order.dealer",
          // pipeline: [
          //   {
          //     $match:
          //     {
          //       $and: [
          //         { "name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
          //       ]
          //     },
          //   }
          // ]
        }
      },
      // {
      // $unwind:{
      //   path:"$order.dealer",
      //   preserveNullAndEmptyArrays: true,
      // }},
      {
        $match:
        {
          $and: [
            { "order.dealer.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "order.customerId",
          foreignField: "_id",
          as: "order.customer",
          // pipeline: [
          //   {
          //     $match:
          //     {
          //       $and: [
          //         { "username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
          //       ]
          //     },
          //   },
          // ]
        }
      },
      {
        $match:
        {
          $and: [
            { "order.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "servicers",
          localField: "order.servicerId",
          foreignField: "_id",
          as: "order.servicer",
          // pipeline: [
          //   {
          //     $match:
          //     {
          //       $and: [
          //         { "name": { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } },
          //       ]
          //     },
          //   }
          // ]
        }
      },
      // {
      //   $match:
      //   {
      //     $and: [
      //       { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } },
      //     ]
      //   },
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
              $lookup: {
                from: "resellers",
                localField: "order.resellerId",
                foreignField: "_id",
                as: "order.reseller",
              }
            },
            {
              $skip: skipLimit
            },
            {
              $limit: pageLimit
            },

          ],



        },

      },
    ]
    // let query = [
    //   {
    //     $match:
    //     {
    //       $and: [
    //         { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
    //         { productName: { $regex: `^${data.productName ? data.productName : ''}` } },
    //         { serial: { $regex: `^${data.serial ? data.serial : ''}` } },
    //         { manufacture: { $regex: `^${data.manufacture ? data.manufacture : ''}` } },
    //         { model: { $regex: `^${data.model ? data.model : ''}` } },
    //         { status: { $regex: `^${data.status ? data.status : ''}` } },
    //         // { eligibility: true },
    //       ]
    //     },
    //   },

    //   {
    //     $lookup: {
    //       from: "orders",
    //       localField: "orderId",
    //       foreignField: "_id",
    //       as: "order",
    //       pipeline: [
    //         {
    //           $lookup: {
    //             from: "dealers",
    //             localField: "dealerId",
    //             foreignField: "_id",
    //             as: "dealer",
    //             pipeline: [
    //               {
    //                 $match:
    //                 {
    //                   $and: [
    //                     { "name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //                   ]
    //                 },
    //               }
    //             ]
    //           }
    //         },
    //         // {

    //         //   $match:
    //         //   {
    //         //     $and: [
    //         //       { "order.dealer.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //         //     ]
    //         //   },

    //         // },
    //         {
    //           $lookup: {
    //             from: "resellers",
    //             localField: "resellerId",
    //             foreignField: "_id",
    //             as: "reseller",
    //           }
    //         },
    //         {
    //           $lookup: {
    //             from: "customers",
    //             localField: "customerId",
    //             foreignField: "_id",
    //             as: "customer",
    //             pipeline: [
    //               {
    //                 $match:
    //                 {
    //                   $and: [

    //                     { "username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
    //                   ]
    //                 },
    //               },
    //             ]
    //           }
    //         },
    //         // {
    //         //   $match:
    //         //   {
    //         //     $and: [

    //         //       { "customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
    //         //     ]
    //         //   },
    //         // },
    //         {
    //           $lookup: {
    //             from: "servicers",
    //             localField: "servicerId",
    //             foreignField: "_id",
    //             as: "servicer",
    //             pipeline: [
    //               {
    //                 $match:
    //                 {
    //                   $and: [
    //                     { "name": { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } },
    //                   ]
    //                 },
    //               }
    //             ]
    //           }
    //         },
    //         // {
    //         //   $match:
    //         //   {
    //         //     $and: [
    //         //       { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } },
    //         //     ]
    //         //   },
    //         // }

    //       ]
    //     }
    //   },

    //   {
    //     $match:
    //     {
    //       $and: [
    //         { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } },
    //         { "order.venderOrder": { $regex: `^${data.venderOrder ? data.venderOrder : ''}` } },
    //         { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //         { "customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
    //         { "order.dealer.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //       ]

    //     },
    //   },

    //   { $sort: { unique_key_number: -1 } },

    //   {
    //     $facet: {
    //       totalRecords: [
    //         {
    //           $count: "total"
    //         }
    //       ],
    //       data: [
    //         {
    //           $skip: skipLimit
    //         },
    //         {
    //           $limit: pageLimit
    //         },
    //       ]
    //     },

    //   },
    // ]
    let getContracts = await contractService.getAllContracts2(query)
    // let getTotalCount = await contractService.findContractCount({ isDeleted: false, })
    let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      totalCount
      // count: getCo
    })

    // res.send({
    //   code: constant.successCode,
    //   message: "Success!",
    //   result: checkOrder,
    //   contractCount: totalContract.length,
    //   orderUserData: userData
    // });


  } catch (err) {
    console.log(err)
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
                from: "servicers",
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
    let orderId = getData[0].orderProductId
    let order = getData[0].order
    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderId.toString())
      productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0].priceBookId) })
      getData[0].order[i].productsArray = productsArray

    }

    // console.log(getData);

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
      message: err.message
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
    let bulk = [];
    for (let i = 0; i < result.length; i++) {
      let contractId = result[i]._id;
      let productValue = result[i].productValue;
      let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'Open' })
      if (result[i].claims.length > 0 & !checkClaim) {
        const query = { contractId: new mongoose.Types.ObjectId(contractId) }
        let claimTotal = await claimService.checkTotalAmount(query);
        if (productValue < claimTotal[0]?.amount) {
          let updateDoc = {
            'updateMany': {
              'filter': { '_id': contractId },
              update: { $set: { eligibilty: true } },
              'upsert': false
            }
          }
          bulk.push(updateDoc)
        }
      }

      else {
        let updateDoc = {
          'updateMany': {
            'filter': { '_id': contractId },
            update: { $set: { eligibilty: false } },
            'upsert': false
          }
        }
        bulk.push(updateDoc)
      }


    }
    const updatedData = await contractService.allUpdate(bulk);
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