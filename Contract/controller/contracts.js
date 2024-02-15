const { Contracts } = require("../model/contract");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractService");
const constant = require("../../config/constant");

// get all contracts api

exports.getAllContracts = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    console.log(pageLimit, skipLimit, limitData)
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
        $match: { isDeleted: false },

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

    let getContracts = await contractService.getAllContracts(query,skipLimit,pageLimit)
    let getTotalCount = await contractService.findContracts({_isDeleted:false})
    console.log('contract++++++++++++', getContracts)
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts,
      totalCount:getTotalCount.length
    })

    // res.send({
    //   code: constant.successCode,
    //   message: "Success!",
    //   result: checkOrder,
    //   contractCount: totalContract.length,
    //   orderUserData: userData
    // });


  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
