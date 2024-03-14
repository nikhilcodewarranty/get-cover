const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const path = require("path");
const { claimStatus } = require("../model/claimStatus");
const { comments } = require("../model/comments");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const emailConstant = require('../../config/emailConstant');
const userService = require("../../User/services/userService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const contractService = require("../../Contract/services/contractService");
const servicerService = require("../../Provider/services/providerService");
const multer = require("multer");
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const priceBookService = require("../../PriceBook/services/priceBookService");
const XLSX = require("xlsx");
const fs = require("fs");
const dealerService = require("../../Dealer/services/dealerService");
const resellerService = require("../../Dealer/services/resellerService");
const customerService = require("../../Customer/services/customerService");
var StorageP = multer.diskStorage({
  destination: function (req, files, cb) {
    cb(null, path.join(__dirname, "../../uploads/claimFile"));
  },
  filename: function (req, files, cb) {
    cb(
      null,
      files.fieldname + "-" + Date.now() + path.extname(files.originalname)
    );
  },
});

var imageUpload = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single("file");

var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).array("file", 100);



exports.getAllClaims = async (req, res, next) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action!'
      })
      return;
    }
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let newQuery = [];
    if (data.orderId) {
      newQuery.push({
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
          pipeline: [
            // {
            //   $match:
            //   {
            //     $and: [
            //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
            //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
            //       { isDeleted: false },
            //     ]
            //   },
            // },

            // {
            //   $lookup: {
            //     from: "dealers",
            //     localField: "dealerId",
            //     foreignField: "_id",
            //     as: "dealers",
            //     pipeline: [
            //       // {
            //       //   $match:
            //       //   {
            //       //     $and: [
            //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
            //       //       { isDeleted: false },
            //       //     ]
            //       //   },
            //       // },
            //       {
            //         $lookup: {
            //           from: "servicer_dealer_relations",
            //           localField: "_id",
            //           foreignField: "dealerId",
            //           as: "dealerServicer",
            //         }
            //       },
            //     ]
            //   }
            // },
            // {
            //   $unwind: "$dealers"
            // },
            // {
            //   $lookup: {
            //     from: "resellers",
            //     localField: "resellerId",
            //     foreignField: "_id",
            //     as: "resellers",
            //   }
            // },
            // {
            //   $lookup: {
            //     from: "serviceproviders",
            //     localField: "servicerId",
            //     foreignField: "_id",
            //     as: "servicers",
            //   }
            // },

          ]
        },

      },
        {
          $unwind: "$contracts.orders"
        },
        {
          $match:
          {
            $and: [
              // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
              { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
              { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
              { "contracts.orders.isDeleted": false },
            ]
          },
        })
    }
    if (data.dealerName) {
      if (data.orderId) {
        newQuery.push(
          {
            $lookup: {
              from: "dealers",
              localField: "contracts.orders.dealerId",
              foreignField: "_id",
              as: "contracts.orders.dealers",
              pipeline: [
                // {
                //   $match:
                //   {
                //     $and: [
                //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
                //       { isDeleted: false },
                //     ]
                //   },
                // },
                // {
                //   $lookup: {
                //     from: "servicer_dealer_relations",
                //     localField: "_id",
                //     foreignField: "dealerId",
                //     as: "dealerServicer",
                //   }
                // },
              ]
            }
          },
          {
            $unwind: "$contracts.orders.dealers"
          },
          {
            $match:
            {
              "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
              // "contracts.orders.dealers.isDeleted": false,
            }

          },
        );
      }
      else {
        newQuery.push(
          {
            $lookup: {
              from: "orders",
              localField: "contracts.orderId",
              foreignField: "_id",
              as: "contracts.orders",
              pipeline: [
                // {
                //   $match:
                //   {
                //     $and: [
                //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
                //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
                //       { isDeleted: false },
                //     ]
                //   },
                // },

                // {
                //   $lookup: {
                //     from: "dealers",
                //     localField: "dealerId",
                //     foreignField: "_id",
                //     as: "dealers",
                //     pipeline: [
                //       // {
                //       //   $match:
                //       //   {
                //       //     $and: [
                //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
                //       //       { isDeleted: false },
                //       //     ]
                //       //   },
                //       // },
                //       {
                //         $lookup: {
                //           from: "servicer_dealer_relations",
                //           localField: "_id",
                //           foreignField: "dealerId",
                //           as: "dealerServicer",
                //         }
                //       },
                //     ]
                //   }
                // },
                // {
                //   $unwind: "$dealers"
                // },
                // {
                //   $lookup: {
                //     from: "resellers",
                //     localField: "resellerId",
                //     foreignField: "_id",
                //     as: "resellers",
                //   }
                // },
                // {
                //   $lookup: {
                //     from: "serviceproviders",
                //     localField: "servicerId",
                //     foreignField: "_id",
                //     as: "servicers",
                //   }
                // },

              ]
            },

          },
          {
            $unwind: "$contracts.orders"
          },
          {
            $match:
            {
              $and: [
                // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
                { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
                { "contracts.orders.isDeleted": false },
              ]
            },
          },
          {
            $lookup: {
              from: "dealers",
              localField: "contracts.orders.dealerId",
              foreignField: "_id",
              as: "contracts.orders.dealers",
              pipeline: [
                // {
                //   $match:
                //   {
                //     $and: [
                //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
                //       { isDeleted: false },
                //     ]
                //   },
                // },
                // {
                //   $lookup: {
                //     from: "servicer_dealer_relations",
                //     localField: "_id",
                //     foreignField: "dealerId",
                //     as: "dealerServicer",
                //   }
                // },
              ]
            }
          },
          {
            $unwind: "$contracts.orders.dealers"
          },
          {
            $match:
            {
              "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
              // "contracts.orders.dealers.isDeleted": false,
            }

          },
        )
      }
    }

    if (data.customerName) {
      if (data.orderId) {
        newQuery.push(
          {
            $lookup: {
              from: "customers",
              localField: "contracts.orders.customerId",
              foreignField: "_id",
              as: "contracts.orders.customer",
              // pipeline: [

              // ]
            }
          },
          {
            $unwind: "$contracts.orders.customer"
          },
          {
            $match:
            {
              $and: [
                { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
                { "contracts.orders.customer.isDeleted": false },
              ]
            },
          },
        );
      }
      else {
        newQuery.push({
          $lookup: {
            from: "orders",
            localField: "contracts.orderId",
            foreignField: "_id",
            as: "contracts.orders",
            pipeline: [
              // {
              //   $match:
              //   {
              //     $and: [
              //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
              //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
              //       { isDeleted: false },
              //     ]
              //   },
              // },

              // {
              //   $lookup: {
              //     from: "dealers",
              //     localField: "dealerId",
              //     foreignField: "_id",
              //     as: "dealers",
              //     pipeline: [
              //       // {
              //       //   $match:
              //       //   {
              //       //     $and: [
              //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
              //       //       { isDeleted: false },
              //       //     ]
              //       //   },
              //       // },
              //       {
              //         $lookup: {
              //           from: "servicer_dealer_relations",
              //           localField: "_id",
              //           foreignField: "dealerId",
              //           as: "dealerServicer",
              //         }
              //       },
              //     ]
              //   }
              // },
              // {
              //   $unwind: "$dealers"
              // },
              // {
              //   $lookup: {
              //     from: "resellers",
              //     localField: "resellerId",
              //     foreignField: "_id",
              //     as: "resellers",
              //   }
              // },
              // {
              //   $lookup: {
              //     from: "serviceproviders",
              //     localField: "servicerId",
              //     foreignField: "_id",
              //     as: "servicers",
              //   }
              // },

            ]
          },

        },
          {
            $unwind: "$contracts.orders"
          },
          {
            $match:
            {
              $and: [
                // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
                { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
                { "contracts.orders.isDeleted": false },
              ]
            },
          },

          {
            $lookup: {
              from: "customers",
              localField: "contracts.orders.customerId",
              foreignField: "_id",
              as: "contracts.orders.customer",
              // pipeline: [

              // ]
            }
          },
          {
            $unwind: "$contracts.orders.customer"
          },
          {
            $match:
            {
              $and: [
                { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
                { "contracts.orders.customer.isDeleted": false },
              ]
            },
          },

        )
      }
    }
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
            $lookup: {
              from: "serviceproviders",
              localField: "contracts.orders.servicerId",
              foreignField: "_id",
              as: "contracts.orders.servicers",
            }
          },
          // {
          //   $project: {
          //     "contractId": 1,
          //     "claimFile": 1,
          //     "unique_key_number": 1,
          //     "unique_key_search": 1,
          //     "unique_key": 1,
          //     "contracts.orderId": 1,
          //     "contracts.productName": 1,
          //     "orders.dealerId": 1,
          //     "orders.servicerId": 1,
          //     "orders.customerId": 1,
          //     "orders.resellerId": 1,
          //   }
          // }

        ]
      }
    })
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId : '', '$options': 'i' } },
            { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatus ? data.customerStatus : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
          // pipeline: [

          //   {
          //     $lookup: {
          //       from: "orders",
          //       localField: "orderId",
          //       foreignField: "_id",
          //       as: "orders",
          //       pipeline: [
          //         {
          //           $match:
          //           {
          //             $and: [
          //               { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
          //               { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
          //               { isDeleted: false },
          //             ]
          //           },
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
          //                     { username: { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
          //                     { isDeleted: false },
          //                   ]
          //                 },
          //               },
          //             ]
          //           }
          //         },
          //         {
          //           $unwind: "$customer"
          //         },
          //         {
          //           $lookup: {
          //             from: "dealers",
          //             localField: "dealerId",
          //             foreignField: "_id",
          //             as: "dealers",
          //             pipeline: [
          //               // {
          //               //   $match:
          //               //   {
          //               //     $and: [
          //               //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
          //               //       { isDeleted: false },
          //               //     ]
          //               //   },
          //               // },
          //               {
          //                 $lookup: {
          //                   from: "servicer_dealer_relations",
          //                   localField: "_id",
          //                   foreignField: "dealerId",
          //                   as: "dealerServicer",
          //                 }
          //               },
          //             ]
          //           }
          //         },
          //         {
          //           $unwind: "$dealers"
          //         },
          //         {
          //           $lookup: {
          //             from: "resellers",
          //             localField: "resellerId",
          //             foreignField: "_id",
          //             as: "resellers",
          //           }
          //         },
          //         {
          //           $lookup: {
          //             from: "serviceproviders",
          //             localField: "servicerId",
          //             foreignField: "_id",
          //             as: "servicers",
          //           }
          //         },

          //       ]
          //     },

          //   },
          //   {
          //     $unwind: "$orders"
          //   },
          // ]
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName : '', '$options': 'i' } },
            { "contracts.isDeleted": false },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
          pipeline: [
            // {
            //   $match:
            //   {
            //     $and: [
            //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
            //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
            //       { isDeleted: false },
            //     ]
            //   },
            // },

            // {
            //   $lookup: {
            //     from: "dealers",
            //     localField: "dealerId",
            //     foreignField: "_id",
            //     as: "dealers",
            //     pipeline: [
            //       // {
            //       //   $match:
            //       //   {
            //       //     $and: [
            //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
            //       //       { isDeleted: false },
            //       //     ]
            //       //   },
            //       // },
            //       {
            //         $lookup: {
            //           from: "servicer_dealer_relations",
            //           localField: "_id",
            //           foreignField: "dealerId",
            //           as: "dealerServicer",
            //         }
            //       },
            //     ]
            //   }
            // },
            // {
            //   $unwind: "$dealers"
            // },
            // {
            //   $lookup: {
            //     from: "resellers",
            //     localField: "resellerId",
            //     foreignField: "_id",
            //     as: "resellers",
            //   }
            // },
            // {
            //   $lookup: {
            //     from: "serviceproviders",
            //     localField: "servicerId",
            //     foreignField: "_id",
            //     as: "servicers",
            //   }
            // },

          ]
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
            { "contracts.orders.isDeleted": false },
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
          pipeline: [
            // {
            //   $match:
            //   {
            //     $and: [
            //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
            //       { isDeleted: false },
            //     ]
            //   },
            // },
            // {
            //   $lookup: {
            //     from: "servicer_dealer_relations",
            //     localField: "_id",
            //     foreignField: "dealerId",
            //     as: "dealerServicer",
            //   }
            // },
          ]
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $match:
        {
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
          // "contracts.orders.dealers.isDeleted": false,
        }
      },
      {
        $lookup: {
          from: "customers",
          localField: "contracts.orders.customerId",
          foreignField: "_id",
          as: "contracts.orders.customer",
          // pipeline: [

          // ]
        }
      },
      {
        $unwind: "$contracts.orders.customer"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
            { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },

    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getAllClaims(lookupQuery, skipLimit, pageLimit);
    //return res.send(allClaims)
    let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

    //Get Dealer and Reseller Servicers
    const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: servicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      if (item1.contracts.orders.dealers.dealerServicer[0]?.servicerId) {
        const servicerId = item1.contracts.orders.dealers.dealerServicer[0]?.servicerId.toString()
        let foundServicer = allServicer.find(item => item._id.toString() === servicerId);

        // console.log("fsdfdsfdsffsdfs",foundServicer);
        servicer.push(foundServicer)
      }
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers[0]?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers[0])
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      return {
        ...item1,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })

    // console.log("servicer====================",servicer);return;

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.searchClaim = async (req, res, next) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action",
      });
      return;
    }
    let lookupCondition = [{ isDeleted: false }]
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let query = [
      {
        $match:
        {
          $and: [
            // { serial: { $regex: `^${data.serial ? data.serial : ''}` } },
            { 'serial': { '$regex': data.serial ? data.serial : '', '$options': 'i' } },
            { 'unique_key': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
            // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { status: 'Active' }
          ]
        },
      },
      {
        $lookup: {
          from: "claims",
          localField: "_id",
          foreignField: "contractId",
          as: "claims",
        }
      },
      {
        $match:
        {
          $and: [
            { "claims.claimFile": { "$ne": "Open" } }
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
          pipeline: [
            {
              $match: {
                $and: [
                  // { "venderOrder": { $regex: `^${data.venderOrder ? data.venderOrder : ''}` } },
                  { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
                  { "unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                ]
              }
            },
            {
              $lookup: {
                from: "customers",
                localField: "customerId",
                foreignField: "_id",
                as: "customers",
              }
            },
            { $unwind: "$customers" },
          ]

        }
      },
      {
        $unwind: "$order"
      },
      {
        $match:
        {
          $and: [
            // { "order.venderOrder": { $regex: `^${data.venderOrder ? data.venderOrder : ''}` } },
            // { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { 'order.customers.username': { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
            // { "order.customers.username": { $regex: `^${data.customerName ? data.customerName : '',}` } },
          ]
        },
      },
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
            }
          ]
        }
      },
    ]

    let getContracts = await contractService.getAllContracts2(query)
    // let getContracts2 = await contractService.getAllContracts2(query2)
    let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      totalCount
      // count: getContracts2.length
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }


}

exports.uploadReceipt = async (req, res, next) => {
  try {
    uploadP(req, res, async (err) => {
      if (req.role != 'Super Admin') {
        res.send({
          code: constant.errorCode,
          message: 'Only suoer admin allow to do this action!'
        });
        return;
      }
      let file = req.files;
      // let filename = file.filename;
      // let originalName = file.originalname;
      // let size = file.size;
      // let files = []

      res.send({
        code: constant.successCode,
        message: 'Success!',
        file
      })
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
    return
  }

}

exports.uploadCommentImage = async (req, res, next) => {
  try {
    imageUpload(req, res, async (err) => {
      if (req.role != 'Super Admin') {
        res.send({
          code: constant.errorCode,
          message: 'Only suoer admin allow to do this action!'
        });
        return;
      }
      let file = req.file;
      res.send({
        code: constant.successCode,
        message: 'Success!',
        messageFile: {
          fileName: file.filename,
          originalName: file.originalname,
          size: file.size
        }
      })
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
    return
  }

}

exports.addClaim = async (req, res, next) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only suoer admin allow to do this action!'
      });
      return;
    }
    let data = req.body;
    let checkContract = await contractService.getContractById({ _id: data.contractId })

    if (!checkContract) {
      res.send({
        code: constant.errorCode,
        message: "Contract not found!"
      })
      return;
    }
    if (data.servicerId) {
      let checkServicer = await servicerService.getServiceProviderById({
        $or: [
          { _id: data.servicerId },
          { resellerId: data.servicerId },
          { dealerId: data.servicerId },

        ]
      })
      if (!checkServicer) {
        res.send({
          code: constant.errorCode,
          message: "Servicer not found!"
        })
        return;
      }
    }

    if (checkContract.status != 'Active') {
      res.send({
        code: constant.errorCode,
        message: 'The contract is not active!'
      });
      return;
    }
    let checkClaim = await claimService.getClaimById({ contractId: data.contractId, claimFile: 'Open' })
    if (checkClaim) {
      res.send({
        code: constant.errorCode,
        message: 'The previous claim is still open!'
      });
      return
    }
    const query = { contractId: new mongoose.Types.ObjectId(data.contractId) }
    let claimTotal = await claimService.checkTotalAmount(query);
    if (checkContract.productValue < claimTotal[0]?.amount) {
      res.send({
        code: consta.errorCode,
        message: 'Claim Amount Exceeds Contract Retail Price'
      });
      return;
    }
    data.receiptImage = data.file
    data.servicerId = data.servicerId ? data.servicerId : null
    let count = await claimService.getClaimCount();

    data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
    data.unique_key_search = "CC" + "2024" + data.unique_key_number
    data.unique_key = "CC-" + "2024-" + data.unique_key_number
    let claimResponse = await claimService.createClaim(data)
    if (!claimResponse) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to add claim of this contract!'
      });
      return
    }
    // Eligibility false when claim open
    const updateContract = await contractService.updateContract({ _id: data.contractId }, { eligibilty: false }, { new: true })
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: claimResponse
    })


  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    })
  }
}

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

exports.editClaim = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.claimId }
    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    let option = { new: true }
    let updateData = await claimService.updateClaim(criteria, data, option)
    if (!updateData) {
      res.send({
        code: constant.errorCode,
        message: "Failed to process your request."
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
exports.editClaimStatus = async (req, res) => {
  try {
    let data = req.body
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action!'
      });
      return
    }
    let criteria = { _id: req.params.claimId }
    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    let status = {};
    let allStatus = {}
    if (data.hasOwnProperty("customerStatus")) {
      if (data.customerStatus == 'Product Received') {
        let option = { new: true }
        let claimStatus = await claimService.updateClaim(criteria, { claimFile: 'Completed' }, option)
        status.claimStatus = [
          {
            status: 'Completed'
          }
        ]
        data.trackStatus = [
          {
            status: 'Completed'
          }
        ]
        let statusClaim = await claimService.updateClaim(criteria, { $push: status }, { new: true })
      }
      data.customerStatus = [
        {
          status: data.customerStatus
        }
      ]
      data.trackStatus = [
        {
          status: data.customerStatus
        }
      ]

    }
    if (data.hasOwnProperty("repairStatus")) {
      data.trackStatus = [
        {
          status: data.repairStatus
        }
      ]
      data.repairStatus = [
        {
          status: data.repairStatus
        }
      ]
    }
    if (data.hasOwnProperty("claimStatus")) {
      let claimStatus = await claimService.updateClaim(criteria, { claimFile: data.claimStatus }, option)
      data.trackStatus = [
        {
          status: data.claimStatus
        }
      ]
      data.claimStatus = [
        {
          status: data.claimStatus
        }
      ]

    }

    let updateStatus = await claimService.updateClaim(criteria, { $push: data }, { new: true })

    if (!updateStatus) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update status!'
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateStatus
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
exports.editServicer = async (req, res) => {
  let data = req.body
  if (req.role != 'Super Admin') {
    res.send({
      code: constant.errorCode,
      message: 'Only super admin allow to do this action!'
    });
    return
  }
  let criteria = { _id: req.params.claimId }
  let checkClaim = await claimService.getClaimById(criteria)
  if (!checkClaim) {
    res.send({
      code: constant.errorCode,
      message: "Invalid claim ID"
    })
    return
  }

  criteria = { _id: req.body.servicerId }
  let checkServicer = await servicerService.getServiceProviderById({
    $or: [
      { _id: req.body.servicerId },
      { dealerId: req.body.servicerId },
      { resellerId: req.body.servicerId },
    ]
  })
  if (!checkServicer) {
    res.send({
      code: constant.errorCode,
      message: "Servicer not found!"
    })
    return
  }

  // console.log('claimId',req.params.claimId)
  // console.log('servicerId',req.body.servicerId);
  // return

  let updateServicer = await claimService.updateClaim({ _id: req.params.claimId }, { servicerId: req.body.servicerId }, { new: true })
  if (!updateServicer) {
    res.send({
      code: constant.errorCode,
      message: 'Unable to update servicer!'
    })
    return;
  }

  res.send({
    code: constant.successCode,
    message: 'Success!',
    result: updateServicer
  })


}

exports.saveBulkClaim = async (req, res) => {
  uploadP(req, res, async (err) => {
    try {
      let data = req.body
      if (req.role != 'Super Admin') {
        res.send({
          code: constant.errorCode,
          message: 'Only super admin allow to do this action!'
        });
        return
      }
      //  console.log(req.files); return;
      const fileUrl = req.file.path
      const jsonOpts = {
        header: 1,
        defval: '',
        blankrows: true,
        raw: false,
        dateNF: 'm"/"d"/"yyyy' // <--- need dateNF in sheet_to_json options (note the escape chars)
      }

      const wb = XLSX.readFile(fileUrl, {
        type: 'binary',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      const sheets = wb.SheetNames;
      const ws = wb.Sheets[sheets[0]];
      let message = [];
      let checkDuplicate = [];
      const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], { defval: "" });
      const totalDataComing = totalDataComing1.map((item, i) => {
        const keys = Object.keys(item);
        return {
          contractId: item[keys[0]],
          servicerName: item[keys[1]],
          lossDate: item[keys[2]],
          diagnosis: item[keys[3]],
          duplicate: false,
          exit: false
        };
      });
      totalDataComing.forEach(data => {
        if (!data.contractId || data.contractId == "") {
          data.status = "ContractId cannot be empty"
          data.exit = true
        }
        if (!data.lossDate || data.lossDate == "") {
          data.status = "Loss date cannot be empty"
          data.exit = true
        }
        if (new Date(data.lossDate) == 'Invalid Date') {
          data.status = "Date is not valid format"
          data.exit = true
        }
        if (new Date(data.lossDate) > new Date()) {
          data.status = "Date can not greater than today"
          data.exit = true
        }
        if (!data.diagnosis || data.diagnosis == "") {
          data.status = "Diagnosis can not be empty"
          data.exit = true
        }
      })

      let cache = {};
      totalDataComing.forEach((data, i) => {
        if (!data.exit) {
          if (cache[data.contractId?.toLowerCase()]) {
            data.status = "Duplicate contract id"
            data.exit = true;
          } else {
            cache[data.contractId?.toLowerCase()] = true;
          }
        }
      })
      //Check contract is exist or not using contract id
      const contractArrayPromise = totalDataComing.map(item => {
        if (!item.exit) return contractService.getContractById({
          unique_key: item.contractId
        });
        else {
          return null;
        }
      })
      const contractArray = await Promise.all(contractArrayPromise);

      //Check servicer is exist or not using contract id

      const servicerArrayPromise = totalDataComing.map(item => {
        if (!item.exit && item.servicerName != '') return servicerService.getServiceProviderById({
          name: item.servicerName
        });
        else {
          return null;
        }
      })
      //console.log(servicerArrayPromise);return;
      const servicerArray = await Promise.all(servicerArrayPromise);
      // console.log(servicerArray);return;
      //check claim is already open by contract id
      const claimArrayPromise = totalDataComing.map(item => {
        if (!item.exit) return claimService.getClaims({
          claimFile: 'Open'

        });
        else {
          return null;
        }
      })

      const claimArray = await Promise.all(claimArrayPromise)

      //Filter data which is contract , servicer and not active
      totalDataComing.forEach((item, i) => {
        if (!item.exit) {
          const contractData = contractArray[i];
          const servicerData = servicerArray[i]
          const claimData = claimArray[i]
          item.contractData = contractData;
          item.servicerData = servicerData
          // console.log(claimData.contractId.toString())
          // console.log(item.contractData)
          if (!contractData) {
            item.status = "Contract not found"
            item.exit = true;
          }
          if (claimData != null && claimData.length > 0) {
            const filter = claimData.filter(claim => claim.contractId.toString() === item.contractData._id.toString())
            if (filter.length > 0) {
              item.status = "Claim is already open of this contract"
              item.exit = true;
            }
            // item.status = "Claim is already open of this contract"
            // item.exit = true;
          }
          if (!servicerData && item.servicerName != '') {
            item.status = "Servicer not found"
            item.exit = true;
          }
          if (contractData.status != "Active") {
            item.status = "Contract is not active";
            item.exit = true;
          }
        } else {
          item.contractData = null
          item.servicerData = null
        }
      })
      let finalArray = []
      //Save bulk claim
      let count = await claimService.getClaimCount();
      let unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
      // unique_key_search = "CC" + "2024" + data.unique_key_number
      // unique_key = "CC-" + "2024-" + data.unique_key_number
      totalDataComing.map((data, index) => {
        if (!data.exit) {
          let obj = {
            contractId: data.contractData._id,
            servicerId: data.servicerData._id,
            unique_key_number: unique_key_number,
            unique_key_search: "CC" + "2024" + unique_key_number,
            unique_key: "CC-" + "2024-" + unique_key_number,
            diagnosis: data.diagnosis,
            lossDate: data.lossDate,
            claimFile: 'Open',
          }
          unique_key_number++
          finalArray.push(obj)
          data.status = 'Add claim successfully!'
        }
      })
      //save bulk claim
      const saveBulkClaim = await claimService.saveBulkClaim(finalArray)
      //send email to receipient
      const csvArray = totalDataComing.map((item, i) => {
        return {
          contractId: item.contractId ? item.contractId : "",
          servicerName: item.servicerName ? item.servicerName : "",
          lossDate: item.lossDate ? new Date(item.lossDate) : '',
          diagnosis: item.diagnosis ? item.diagnosis : '',
          status: item.status ? item.status : '',
        }
      })
      function convertArrayToHTMLTable(array) {
        const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
        const rows = array.map(obj => {
          const values = Object.values(obj).map(value => `<td>${value}</td>`);
          values[2] = `${values[2]}`;
          return values.join('');
        });

        const htmlContent = `<html>
            <head>
                <style>
                    table {
                        border-collapse: collapse;
                        width: 100%; 
                    }
                    th, td {
                        border: 1px solid #dddddd;
                        text-align: left;
                        padding: 8px;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                </style>
            </head>
            <body>
                <table>
                    <thead><tr>${header}</tr></thead>
                    <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                </table>
            </body>
        </html>`;

        return htmlContent;
      }

      const htmlTableString = convertArrayToHTMLTable(csvArray);
      const mailing = sgMail.send(emailConstant.sendCsvFile('amit@codenomad.net', htmlTableString));

      res.send({
        code: constant.successCode,
        message: 'Success!',
        result: saveBulkClaim
      })


    }
    catch (err) {
      res.send({
        code: constant.errorCode,
        message: err.message
      })
    }
  })

}

exports.sendMessages = async (req, res) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action!'
      });
      return
    }
    let data = req.body
    let criteria = { _id: req.params.claimId }
    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    data.claimId = req.params.claimId
    let orderData = await orderService.getOrder({ _id: data.orderId }, { isDeleted: false })
    if (!orderData) {
      res.send({
        code: constant.errorCode,
        message: 'Order is not found for this claim!'
      })
      return
    }
    // console.log(" req.userId==================", req.role);return;
    data.commentedBy = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
    data.commentedTo = '65f01eed2f048cac854daaa5';
    if (data.type == 'Reseller') {
      data.commentedTo = orderData.resellerId
    }
    else if (data.type == 'Dealer') {
      data.commentedTo = orderData.dealerId
    }
    else if (data.type == 'Customer') {
      data.commentedTo = orderData.customerId
    }
    else if (data.type == 'Servicer') {
      data.commentedTo = orderData.servicerId
    }
    let sendMessage = await claimService.addMessage(data)

    if (!sendMessage) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to send message!'
      });
      return;
    }

    res.send({
      code: constant.successCode,
      messages: 'Message Sent!',
      result: sendMessage
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      messages: err.message
    })
  };
}
exports.getMessages = async (req, res) => {
  if (req.role != 'Super Admin') {
    res.send({
      code: constant.errorCode,
      message: 'Only super admin allow to do this action'
    })
    return
  }
  const checkClaim = await claimService.getClaimById({ _id: req.params.claimId }, { isDeleted: false })
  if (!checkClaim) {
    res.send({
      code: constant.errorCode,
      message: 'Invalid Claim id!'
    })
    return;
  }
  let lookupQuery = [
    {
      $match:
      {
        $and: [
          { claimId: new mongoose.Types.ObjectId(req.params.claimId) }
        ]
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "commentedTo",
        foreignField: "metaId",
        as: "commentTo",
        pipeline: [
          {
            $match:
            {
              $and: [
                { isPrimary: true }
              ]
            },
          }
        ]

      }
    },
    {
      $unwind: "$commentTo"
    },
    {
      $lookup: {
        from: "users",
        localField: "commentedBy",
        foreignField: "metaId",
        as: "commentBy",
        pipeline: [
          {
            $match:
            {
              $and: [
                { isPrimary: true }
              ]
            },
          },
          {
            $lookup: {
              from: 'roles',
              localField: 'roleId',
              foreignField: '_id',
              as: 'roles'
            }
          },
          {
            $unwind: "$roles"
          }
        ]
      }
    },
    {
      $unwind: "$commentBy"
    },
    {
      $project: {
        _id: 1,
        date: 1,
        type: 1,
        messageFile: 1,
        content: 1,
        "commentBy.firstName": 1,
        "commentBy.lastName": 1,
        "commentTo.firstName": 1,
        "commentTo.lastName": 1,
        "commentBy.roles.role": 1
      }
    }
  ]

  let allMessages = await claimService.getAllMessages(lookupQuery);
  res.send({
    code: constant.successCode,
    messages: 'Success!',
    result: allMessages
  })
}
exports.statusClaim = async (req, res) => {
  try {
    const result = await claimService.getClaims({
      'repairStatus.status': 'Servicer Shipped',
    });
    let updateStatus
    for (let i = 0; i < result.length; i++) {
      let messageData = {};
      const repairStatus = result[i].repairStatus;
      const claimId = result[i]._id;
      const customerStatus = result[i].customerStatus;
      //Get latest Servicer Shipped Status
      const latestServicerShipped = repairStatus.reduce((latest, current) => {
        if (current.status === "Servicer Shipped" && new Date(current.date) > new Date(latest.date)) {
          return current;
        }
        return latest;
      }, repairStatus[0]);
      //Get Customer last response
      const customerLastResponseDate = customerStatus.reduce((latest, current) => {
        if (new Date(current.date) > new Date(latest.date)) {
          return current;
        }
        return latest;
      }, customerStatus[0]);

      const latestServicerShippedDate = new Date(latestServicerShipped.date);
      const sevenDaysAfterShippedDate = new Date(latestServicerShippedDate);
      sevenDaysAfterShippedDate.setDate(sevenDaysAfterShippedDate.getDate() + 7);
      if (
        customerLastResponseDate > latestServicerShippedDate &&
        customerLastResponseDate < sevenDaysAfterShippedDate
      ) {
        console.log("Customer response is within 7 days after the last servicer shipped date.");
      } else {
        messageData.claimStatus = [
          {
            status: 'Completed'
          }
        ]
      }
      updateStatus = await claimService.updateClaim({ _id: claimId }, {
        $push: messageData,
        $set: { claimFile: 'Completed' }
      }, { new: true })
    }
    res.send({
      code: constant.successCode,
      updateStatus
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
exports.saveBulkData = async (req, res) => {
  try {

    res.send({
      code: constant.successCode,
      result
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getMaxClaimAmount = async (req, res) => {
  try {
    const query = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotal = await claimService.checkTotalAmount(query);
    const contract = await contractService.getContractById({ _id: req.params.contractId }, { productValue: 1 })
    const claimAmount = claimTotal[0]?.amount ? claimTotal[0]?.amount : 0
    const product = contract ? contract.productValue : 0
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: product - claimAmount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}