const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const contractService = require("../../Contract/services/contractService");
const constant = require("../../config/constant");
exports.searchClaim = async (req, res, next) => {
  let data = req.body
  if (req.role != "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only super admin allow to do this action",
    });
    return;
  }
  let lookupCondition = [{ isDeleted: false }]
  if (data.serial) {
    lookupCondition.push({ "serial": data.serial },)
  }
  if (data.contractId) {
    lookupCondition.push({ "unique_key": data.contractId })
  }
  if (data.venderOrder) {
    lookupCondition.push({ "order.venderOrder": data.venderOrder })
  }
  if (data.orderId) {
    lookupCondition.push({ "order.unique_key": data.orderId },)
  }
  let query = [
    {
      $match: {
        $and: lookupCondition
      },
    },


    {
      $lookup: {
        from: "contracts",
        localField: "_id",
        foreignField: "orderId",
        as: "contracts"
      }
    }
    // {
    //   $lookup: {
    //     from: "orders",
    //     localField: "orderId",
    //     foreignField: "_id",
    //     as: "order",
    //     pipeline: [
    //       // {
    //       //   $lookup: {
    //       //     from: "dealers",
    //       //     localField: "dealerId",
    //       //     foreignField: "_id",
    //       //     as: "dealer",
    //       //   }
    //       // },
    //       // {
    //       //   $lookup: {
    //       //     from: "resellers",
    //       //     localField: "resellerId",
    //       //     foreignField: "_id",
    //       //     as: "reseller",
    //       //   }
    //       // },
    //       {
    //         $lookup: {
    //           from: "customers",
    //           let: { customerId: '$order.customerId' },
    //           pipeline: [
    //             {
    //               $match: {
    //                 $expr: {
    //                   $and: [
    //                     { $eq: ['$_id', '$$customerId'] },
    //                     { $eq: ['$username', 'testtttttt'] },
    //                   ]
    //                 }
    //               }
    //             }
    //           ],
    //           as: "customers"
    //         }
    //       },
    //       // {
    //       //   $lookup: {
    //       //     from: "servicers",
    //       //     localField: "servicerId",
    //       //     foreignField: "_id",
    //       //     as: "servicer",
    //       //   }
    //       // },
    //     ]

    //   }
    // },
    // {
    //   $unwind: "$order"
    // },
    // {
    //   $match:
    //   {
    //     $and: lookupCondition
    //   },

    // },
  ]

  let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
  let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
  let limitData = Number(pageLimit)
  console.log("check+++++++++++++++++=")
  let getContracts = await orderService.getOrderWithContract(query, skipLimit, pageLimit)
  console.log("check+++++++++++++++++=", getContracts[0])

  res.send({
    code: constant.successCode,
    result: getContracts
  })

}
