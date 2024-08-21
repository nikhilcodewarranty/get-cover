require("dotenv").config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const XLSX = require("xlsx");
const userResourceResponse = require("../utils/constant");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const dealerService = require('../../Dealer/services/dealerService')
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const logs = require('../../User/model/logs');
const csvParser = require('csv-parser');
const reportingController = require("./reportingController");
const orderService = require("../../Order/services/orderService");
const claimService = require("../../Claim/services/claimService");


//Get Sales Reporting
exports.saleReporting = async (req, res) => {
  try {

    let bodyData = req.body
    bodyData.role = req.role

    bodyData.returnValue = {
      total_broker_fee: 1,
      total_admin_fee: 1,
      total_fronting_fee: 1,
      total_reserve_future_fee: 1,
      total_contracts: 1,
      total_reinsurance_fee: 1,
      // total_retail_price: match ? match.total_retail_price : item.total_retail_price,
      wholesale_price: 1
    };

    if (bodyData.flag == "daily") {
      let sales = await reportingController.dailySales1(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "weekly") {
      let sales = await reportingController.weeklySales(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "day") {
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

//Get dashboard info
exports.getDashboardInfo = async (req, res) => {
  if (req.role != 'Super Admin') {
    res.send({
      code: constant.errorCode,
      message: "Only Super admin allow to do this action"
    })
    return;
  }

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

    { $sort: { unique_key_number: -1 } },
    {
      $limit: 5
    },
  ]

  const lastFiveOrder = await orderService.getOrderWithContract1(orderQuery, 1, 5)

  const claimQuery = [
    {
      $match: {
        claimFile: "Completed"
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
      $match: {
        accountStatus: true
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
        resellerId: null,
        status: true
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
    lastFiveOrder: lastFiveOrder,
    lastFiveClaims: getLastNumberOfClaims,
    topFiveDealer: topFiveDealer,
    topFiveServicer: topFiveServicer

  }
  res.send({
    code: constant.successCode,
    result: result
  })
}

//Get dashboard graph data
exports.getDashboardGraph = async (req, res) => {
  try {
    let data = req.body
    // sku data query ++++++++

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

    // let data = req.body
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
      order_result: result1,
      monthly_sku: getPriceBooks,
      yealy_sku: getPriceBooks1
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Claim Reporting
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
      let claim = await reportingController.claimDailyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "weekly") {
      let claim = await reportingController.claimWeeklyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "day") {
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

//Get SKU Data
exports.getSkuData = async (req, res) => {
  try {
    let endOfMonth1s = new Date();
    let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));
    let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));
    let startOfMonths = new Date(startOfMonth2s.getFullYear(), startOfMonth2s.getMonth(), startOfMonth2s.getDate());
    let startOfMonth1s = new Date(startOfYear2s.getFullYear(), startOfYear2s.getMonth(), startOfYear2s.getDate());
    let endOfMonths = new Date(endOfMonth1s.getFullYear(), endOfMonth1s.getMonth(), endOfMonth1s.getDate() + 1);
    let orderQuery = [
      {
        $match: {
          updatedAt: { $gte: startOfMonths, $lte: endOfMonths }
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

    let orderQuery1 = [
      {
        $match: {
          updatedAt: { $gte: startOfMonth1s, $lte: endOfMonths }
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

    let getOrders = await orderService.getAllOrders1(orderQuery)
    let getOrders1 = await orderService.getAllOrders1(orderQuery1)
    res.send({
      code: constant.successCode,
      message: "Success",
      result1: getOrders,
      result2: getOrders1,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}