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
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const userService = require("../../User/services/userService");
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
const providerService = require("../../Provider/services/providerService");


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
    // if (req.role != 'Super Admin') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Only super admin allow to do this action!'
    //   })
    //   return;
    // }
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }

    let newQuery = [];
    // if (data.orderId) {
    //   newQuery.push({
    //     $lookup: {
    //       from: "orders",
    //       localField: "contracts.orderId",
    //       foreignField: "_id",
    //       as: "contracts.orders",
    //       pipeline: [
    //         // {
    //         //   $match:
    //         //   {
    //         //     $and: [
    //         //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //         //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //         //       { isDeleted: false },
    //         //     ]
    //         //   },
    //         // },

    //         // {
    //         //   $lookup: {
    //         //     from: "dealers",
    //         //     localField: "dealerId",
    //         //     foreignField: "_id",
    //         //     as: "dealers",
    //         //     pipeline: [
    //         //       // {
    //         //       //   $match:
    //         //       //   {
    //         //       //     $and: [
    //         //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //         //       //       { isDeleted: false },
    //         //       //     ]
    //         //       //   },
    //         //       // },
    //         //       {
    //         //         $lookup: {
    //         //           from: "servicer_dealer_relations",
    //         //           localField: "_id",
    //         //           foreignField: "dealerId",
    //         //           as: "dealerServicer",
    //         //         }
    //         //       },
    //         //     ]
    //         //   }
    //         // },
    //         // {
    //         //   $unwind: "$dealers"
    //         // },
    //         // {
    //         //   $lookup: {
    //         //     from: "resellers",
    //         //     localField: "resellerId",
    //         //     foreignField: "_id",
    //         //     as: "resellers",
    //         //   }
    //         // },
    //         // {
    //         //   $lookup: {
    //         //     from: "serviceproviders",
    //         //     localField: "servicerId",
    //         //     foreignField: "_id",
    //         //     as: "servicers",
    //         //   }
    //         // },

    //       ]
    //     },

    //   },
    //     {
    //       $unwind: "$contracts.orders"
    //     },
    //     {
    //       $match:
    //       {
    //         $and: [
    //           // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //           { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
    //           { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //           { "contracts.orders.isDeleted": false },
    //         ]
    //       },
    //     })
    // }
    // if (data.dealerName) {
    //   if (data.orderId) {
    //     newQuery.push(
    //       {
    //         $lookup: {
    //           from: "dealers",
    //           localField: "contracts.orders.dealerId",
    //           foreignField: "_id",
    //           as: "contracts.orders.dealers",
    //           pipeline: [
    //             // {
    //             //   $match:
    //             //   {
    //             //     $and: [
    //             //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //             //       { isDeleted: false },
    //             //     ]
    //             //   },
    //             // },
    //             // {
    //             //   $lookup: {
    //             //     from: "servicer_dealer_relations",
    //             //     localField: "_id",
    //             //     foreignField: "dealerId",
    //             //     as: "dealerServicer",
    //             //   }
    //             // },
    //           ]
    //         }
    //       },
    //       {
    //         $unwind: "$contracts.orders.dealers"
    //       },
    //       {
    //         $match:
    //         {
    //           "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
    //           // "contracts.orders.dealers.isDeleted": false,
    //         }

    //       },
    //     );
    //   }
    //   else {
    //     newQuery.push(
    //       {
    //         $lookup: {
    //           from: "orders",
    //           localField: "contracts.orderId",
    //           foreignField: "_id",
    //           as: "contracts.orders",
    //           pipeline: [
    //             // {
    //             //   $match:
    //             //   {
    //             //     $and: [
    //             //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //             //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //             //       { isDeleted: false },
    //             //     ]
    //             //   },
    //             // },

    //             // {
    //             //   $lookup: {
    //             //     from: "dealers",
    //             //     localField: "dealerId",
    //             //     foreignField: "_id",
    //             //     as: "dealers",
    //             //     pipeline: [
    //             //       // {
    //             //       //   $match:
    //             //       //   {
    //             //       //     $and: [
    //             //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //             //       //       { isDeleted: false },
    //             //       //     ]
    //             //       //   },
    //             //       // },
    //             //       {
    //             //         $lookup: {
    //             //           from: "servicer_dealer_relations",
    //             //           localField: "_id",
    //             //           foreignField: "dealerId",
    //             //           as: "dealerServicer",
    //             //         }
    //             //       },
    //             //     ]
    //             //   }
    //             // },
    //             // {
    //             //   $unwind: "$dealers"
    //             // },
    //             // {
    //             //   $lookup: {
    //             //     from: "resellers",
    //             //     localField: "resellerId",
    //             //     foreignField: "_id",
    //             //     as: "resellers",
    //             //   }
    //             // },
    //             // {
    //             //   $lookup: {
    //             //     from: "serviceproviders",
    //             //     localField: "servicerId",
    //             //     foreignField: "_id",
    //             //     as: "servicers",
    //             //   }
    //             // },

    //           ]
    //         },

    //       },
    //       {
    //         $unwind: "$contracts.orders"
    //       },
    //       {
    //         $match:
    //         {
    //           $and: [
    //             // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //             { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
    //             { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //             { "contracts.orders.isDeleted": false },
    //           ]
    //         },
    //       },
    //       {
    //         $lookup: {
    //           from: "dealers",
    //           localField: "contracts.orders.dealerId",
    //           foreignField: "_id",
    //           as: "contracts.orders.dealers",
    //           pipeline: [
    //             // {
    //             //   $match:
    //             //   {
    //             //     $and: [
    //             //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //             //       { isDeleted: false },
    //             //     ]
    //             //   },
    //             // },
    //             // {
    //             //   $lookup: {
    //             //     from: "servicer_dealer_relations",
    //             //     localField: "_id",
    //             //     foreignField: "dealerId",
    //             //     as: "dealerServicer",
    //             //   }
    //             // },
    //           ]
    //         }
    //       },
    //       {
    //         $unwind: "$contracts.orders.dealers"
    //       },
    //       {
    //         $match:
    //         {
    //           "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' },
    //           // "contracts.orders.dealers.isDeleted": false,
    //         }

    //       },
    //     )
    //   }
    // }

    // if (data.customerName) {
    //   if (data.orderId) {
    //     newQuery.push(
    //       {
    //         $lookup: {
    //           from: "customers",
    //           localField: "contracts.orders.customerId",
    //           foreignField: "_id",
    //           as: "contracts.orders.customer",
    //           // pipeline: [

    //           // ]
    //         }
    //       },
    //       {
    //         $unwind: "$contracts.orders.customer"
    //       },
    //       {
    //         $match:
    //         {
    //           $and: [
    //             { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
    //             { "contracts.orders.customer.isDeleted": false },
    //           ]
    //         },
    //       },
    //     );
    //   }
    //   else {
    //     newQuery.push({
    //       $lookup: {
    //         from: "orders",
    //         localField: "contracts.orderId",
    //         foreignField: "_id",
    //         as: "contracts.orders",
    //         pipeline: [
    //           // {
    //           //   $match:
    //           //   {
    //           //     $and: [
    //           //       { unique_key: { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //           //       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //           //       { isDeleted: false },
    //           //     ]
    //           //   },
    //           // },

    //           // {
    //           //   $lookup: {
    //           //     from: "dealers",
    //           //     localField: "dealerId",
    //           //     foreignField: "_id",
    //           //     as: "dealers",
    //           //     pipeline: [
    //           //       // {
    //           //       //   $match:
    //           //       //   {
    //           //       //     $and: [
    //           //       //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
    //           //       //       { isDeleted: false },
    //           //       //     ]
    //           //       //   },
    //           //       // },
    //           //       {
    //           //         $lookup: {
    //           //           from: "servicer_dealer_relations",
    //           //           localField: "_id",
    //           //           foreignField: "dealerId",
    //           //           as: "dealerServicer",
    //           //         }
    //           //       },
    //           //     ]
    //           //   }
    //           // },
    //           // {
    //           //   $unwind: "$dealers"
    //           // },
    //           // {
    //           //   $lookup: {
    //           //     from: "resellers",
    //           //     localField: "resellerId",
    //           //     foreignField: "_id",
    //           //     as: "resellers",
    //           //   }
    //           // },
    //           // {
    //           //   $lookup: {
    //           //     from: "serviceproviders",
    //           //     localField: "servicerId",
    //           //     foreignField: "_id",
    //           //     as: "servicers",
    //           //   }
    //           // },

    //         ]
    //       },

    //     },
    //       {
    //         $unwind: "$contracts.orders"
    //       },
    //       {
    //         $match:
    //         {
    //           $and: [
    //             // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
    //             { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId : '', '$options': 'i' } },
    //             { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
    //             { "contracts.orders.isDeleted": false },
    //           ]
    //         },
    //       },

    //       {
    //         $lookup: {
    //           from: "customers",
    //           localField: "contracts.orders.customerId",
    //           foreignField: "_id",
    //           as: "contracts.orders.customer",
    //           // pipeline: [

    //           // ]
    //         }
    //       },
    //       {
    //         $unwind: "$contracts.orders.customer"
    //       },
    //       {
    //         $match:
    //         {
    //           $and: [
    //             { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName : '', '$options': 'i' } },
    //             { "contracts.orders.customer.isDeleted": false },
    //           ]
    //         },
    //       },

    //     )
    //   }
    // }
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
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
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
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": 1,
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
                    "isServicer": "$$reseller.isServicer"
                  }
                }
              }
            }
          },
        ]
      }
    })
    let servicerMatch = {}
    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getServiceProviderById({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer) {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId(checkServicer._id) }
      }
      else {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
      }
    }
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            servicerMatch
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
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.isDeleted": false },
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
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
          // "contracts.orders.dealers.isDeleted": false,
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
            // { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },
    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getAllClaims(lookupQuery);

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
    // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    let servicerName = '';
    // console.log("servicerIds=================", allServicerIds);
    // res.json(resultFiter)
    // return
    allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers)
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
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
    // if (req.role != "Super Admin") {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Only super admin allow to do this action",
    //   });
    //   return;
    // }
    let match = {};
    if (req.role == 'Dealer') {
      match = { 'dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'customerId': new mongoose.Types.ObjectId(req.userId) }
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
            { 'serial': { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { status: 'Active' },
            { eligibilty: true }
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
                  { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                  { "unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                  match
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
            { 'order.customers.username': { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
            },
            {
              $project: {
                unique_key: 1,
                serial: 1,
                "order.customers.username": 1,
                "order.unique_key": 1,
                "order.venderOrder": 1,
              }
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
      // if (req.role != 'Super Admin') {
      //   res.send({
      //     code: constant.errorCode,
      //     message: 'Only suoer admin allow to do this action!'
      //   });
      //   return;
      // }
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
    // if (req.role != 'Super Admin') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Only suoer admin allow to do this action!'
    //   });
    //   return;
    // }
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
    if (new Date(checkContract.coverageStartDate) > new Date(data.lossDate)) {
      res.send({
        code: constant.errorCode,
        message: 'Loss date should be in between coverage start date and present date!'
      });
      return;
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
    let remainingPrice = checkContract.productValue - claimTotal[0]?.amount
    if (checkContract.productValue <= claimTotal[0]?.amount) {
      res.send({
        code: constant.errorCode,
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

    let orderId = getData[0].orderProductId
    let order = getData[0].order
    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderId.toString())
      productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0].priceBookId) })
      getData[0].order[i].productsArray = productsArray
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
      message: err.message
    })
  }
}

// Edit Repair part 
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
    let contract = await contractService.getContractById({ _id: checkClaim.contractId });
    const query = { contractId: new mongoose.Types.ObjectId(checkClaim.contractId) }
    let claimTotal = await claimService.checkTotalAmount(query);
    const remainingValue = contract.productValue - claimTotal[0]?.amount
    // if (contract.productValue < data.totalAmount || contract.productValue < claimTotal[0]?.amount) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Claim Amount Exceeds Contract Retail Price'
    //   });
    //   return;
    // }
    if (remainingValue <= data.totalAmount) {
      res.send({
        code: constant.errorCode,
        message: 'Claim Amount Exceeds Contract Retail Price'
      });
      return;
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

// Claim Paid and unpaid api

exports.paidUnpaidClaim = async (req, res) => {
  try {
    let data = req.body
    const flag = req.params.flag == 1 ? 'Paid' : 'Unpaid'
    console.log("flag-----------------", flag)
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
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
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              claimPaymentStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.serial": 1,
              "contracts.orders.dealerId": 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": 1,
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
                    "isServicer": "$$reseller.isServicer"
                  }
                }
              }
            }
          },
        ]
      }
    })
    let servicerMatch = {}
    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getServiceProviderById({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer) {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId(checkServicer._id) }
      }
      else {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
      }
    }
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': 'Completed' },
            { claimPaymentStatus: flag },
            servicerMatch
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
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
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
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
          // "contracts.orders.dealers.isDeleted": false,
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
            // { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },
    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getAllClaims(lookupQuery);

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
    // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    let servicerName = '';
    allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers)
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })
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

exports.editClaimStatus = async (req, res) => {
  try {
    let data = req.body
    // if (req.role != 'Super Admin') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Only super admin allow to do this action!'
    //   });
    //   return
    // }
    let criteria = { _id: req.params.claimId }
    let checkClaim = await claimService.getClaimById(criteria)
    if (!checkClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    const query = { contractId: new mongoose.Types.ObjectId(checkClaim.contractId) }
    let checkContract = await contractService.getContractById({ _id: checkClaim.contractId })
    let claimTotal = await claimService.checkTotalAmount(query);
    let status = {};
    let updateData = {};
    if (data.hasOwnProperty("customerStatus")) {
      if (data.customerStatus == 'Product Received') {
        let option = { new: true }
        let claimStatus = await claimService.updateClaim(criteria, { claimFile: 'Completed' }, option)
        updateData.claimStatus = [
          {
            status: 'Completed',
            date: new Date()
          }
        ]
        status.trackStatus = [
          {
            status: 'Completed',
            date: new Date()
          }
        ]
        let statusClaim = await claimService.updateClaim(criteria, { updateData }, { new: true })
      }
      updateData.customerStatus = [
        {
          status: data.customerStatus,
          date: new Date()
        }
      ]
      status.trackStatus = [
        {
          status: data.customerStatus,
          date: new Date()
        }
      ]

    }
    if (data.hasOwnProperty("repairStatus")) {
      status.trackStatus = [
        {
          status: data.repairStatus,
          date: new Date()
        }
      ]
      updateData.repairStatus = [
        {
          status: data.repairStatus,
          date: new Date()
        }
      ]
    }
    if (data.hasOwnProperty("claimStatus")) {
      let claimStatus = await claimService.updateClaim(criteria, { claimFile: data.claimStatus, reason: data.reason ? data.reason : '' }, { new: true })
      status.trackStatus = [
        {
          status: data.claimStatus,
          date: new Date()
        }
      ]
      updateData.claimStatus = [
        {
          status: data.claimStatus,
          date: new Date()
        }
      ]
      // if (data.claimStatus == 'Completed') {
      //   if (checkContract.productValue > claimTotal[0]?.amount) {
      //     const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
      //   }
      //   else if (checkContract.productValue < claimTotal[0]?.amount) {
      //     const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: false }, { new: true })
      //   }
      // } 
    }
    // Keep history of status in mongodb 
    let updateStatus = await claimService.updateClaim(criteria, { $push: status }, { new: true })

    // Update every status 
    let updateBodyStatus = await claimService.updateClaim(criteria, updateData, { new: true })
    if (!updateStatus) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update status!'
      })
      return;
    }
    if (updateBodyStatus.claimFile == 'Completed') {
      if (checkContract.productValue > claimTotal[0]?.amount) {
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
      }
      else if (checkContract.productValue < claimTotal[0]?.amount) {
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: false }, { new: true })
      }
    }
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateBodyStatus
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
  // if (req.role != 'Super Admin') {
  //   res.send({
  //     code: constant.errorCode,
  //     message: 'Only super admin allow to do this action!'
  //   });
  //   return
  // }
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
      // if (req.role != 'Super Admin') {
      //   res.send({
      //     code: constant.errorCode,
      //     message: 'Only super admin allow to do this action!'
      //   });
      //   return
      // }
      // console.log(req.files[0].path); return;
      const fileUrl = req.files[0].path
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
      const headers = [];
      for (let cell in ws) {
        // Check if the cell is in the first row and has a non-empty value
        if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
          headers.push(ws[cell].v);
        }
      }

      if (headers.length !== 4) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file format detected. The sheet should contain exactly four columns."
        })
        return
      }
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
        // data.diagnosis.replace(/\s+/g, ' ').trim();
        // data.servicerName.replace(/\s+/g, ' ').trim();
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
        data.lossDate = data.lossDate
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
          unique_key: { '$regex': item.contractId ? item.contractId : '', '$options': 'i' }
        });
        else {
          return null;
        }
      })
      const contractArray = await Promise.all(contractArrayPromise);

      //Check servicer is exist or not using contract id

      const servicerArrayPromise = totalDataComing.map(item => {
        if (!item.exit && item.servicerName != '') return servicerService.getServiceProviderById({
          name: { '$regex': item.servicerName ? item.servicerName : '', '$options': 'i' }
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
      // Get Contract with dealer, customer, reseller
      const contractAllDataPromise = totalDataComing.map(item => {
        if (!item.exit) {
          let query = [
            {
              $match: { unique_key: { '$regex': item.contractId ? item.contractId : '', '$options': 'i' } },
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
                      pipeline: [
                        {
                          $lookup: {
                            from: "servicer_dealer_relations",
                            localField: "_id",
                            foreignField: "dealerId",
                            as: "dealerServicer",
                          }
                        },
                      ]
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
                      from: "serviceproviders",
                      localField: "servicerId",
                      foreignField: "_id",
                      as: "servicer",
                    }
                  },
                ],
              },
            },
            {
              $project: {
                orderId: 1,
                "order.dealerId": 1,
                "order.servicerId": 1,
                "order.resellerId": 1,
                "order.dealer": 1,
                "order.reseller": 1,
                "order.servicer": 1
              }
            },
            { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.dealer", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.reseller", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.servicer", preserveNullAndEmptyArrays: true } },
          ]
          return contractService.getAllContracts2(query)
        }
        else {
          return null;
        }
      })
      const contractAllDataArray = await Promise.all(contractAllDataPromise)

      // res.json(contractAllDataArray);return;
      // const contractAllDataPromise = totalDataComing.map(item => {
      //   if (!item.exit) {
      //     let query = [
      //       {
      //         $match: { name: { '$regex': item.servicerName ? item.servicerName : '', '$options': 'i' } },
      //       },
      //       {
      //         $addFields: {
      //           convertedId: { $toObjectId: "$resellerId" }
      //         }
      //       },
      //       {
      //         "$lookup": {
      //           "let": { "userObjId": { "$toObjectId": "$resellerId" } },
      //           "from": "resellers",
      //           "pipeline": [
      //             { "$match": { "$expr": { "$eq": ["$_id", "$$userObjId"] } } }
      //           ],
      //           "as": "userDetails"
      //         },

      //       },
      //       {
      //         $unwind: {
      //           path: "$userDetails",
      //           preserveNullAndEmptyArrays: true,
      //         }
      //       },
      //     ]
      //     // return contractService.getAllContracts2(query)
      //     return servicerService.getAggregateServicer(query)
      //   }
      //   else {
      //     return null;
      //   }
      // })

      //Filter data which is contract , servicer and not active
      totalDataComing.forEach((item, i) => {
        if (!item.exit) {
          const contractData = contractArray[i];
          const servicerData = servicerArray[i]
          const allDataArray = contractAllDataArray[i];
          const claimData = claimArray[i];
          let flag = false;
          item.contractData = contractData;
          item.servicerData = servicerData
          if (!contractData) {
            item.status = "Contract not found"
            item.exit = true;
          }
          if (item.contractData && claimData != null && claimData.length > 0) {
            const filter = claimData.filter(claim => claim.contractId.toString() === item.contractData._id.toString())
            if (filter.length > 0) {
              item.status = "Claim is already open of this contract"
              item.exit = true;
            }
            // item.status = "Claim is already open of this contract"
            // item.exit = true;
          }
          if (allDataArray.length > 0 && servicerData) {
            //console.log("allDataArray--------------------------", i, allDataArray[0]?.order.dealer.dealerServicer, servicerData)
            if (allDataArray[0]?.order.dealer.dealerServicer.length > 0) {
              //Find Servicer with dealer Servicer
              const servicerCheck = allDataArray[0]?.order.dealer.dealerServicer.find(item => item.servicerId.toString() === servicerData._id.toString())
              if (servicerCheck) {
                flag = true
              }
            }
            //Check dealer itself servicer
            if (allDataArray[0]?.order.dealer.isServicer && allDataArray[0]?.order.dealer._id.toString() === servicerData.dealerId.toString) {
              flag = true
            }

            if (allDataArray[0]?.order.reseller.isServicer && allDataArray[0]?.order.reseller._id.toString() === servicerData.resellerId.toString) {
              flag = true
            }
            // console.log(allDataArray)
          }
          if (!flag) {
            item.status = "Servicer not found"
            item.exit = true;
          }
          if (contractData && contractData.status != "Active") {
            item.status = "Contract is not active";
            item.exit = true;
          }
        } else {
          item.contractData = null
          item.servicerData = null
        }
      })
      // res.send({
      //   totalDataComing
      // })
      // return;
      let finalArray = []
      //Save bulk claim
      let count = await claimService.getClaimCount();
      let unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
      // unique_key_search = "CC" + "2024" + data.unique_key_number
      // unique_key = "CC-" + "2024-" + data.unique_key_number

      //Update eligibility when contract is open

      const updateArrayPromise = totalDataComing.map(item => {
        if (!item.exit && item.contractData) return contractService.updateContract({ _id: item.contractData._id }, { eligibilty: false }, { new: true });
        else {
          return null;
        }
      })
      const updateArray = await Promise.all(updateArrayPromise);
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
          lossDate: item.lossDate ? item.lossDate : '',
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
    // if (req.role != 'Super Admin') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: 'Only super admin allow to do this action!'
    //   });
    //   return
    // }
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
    data.commentedBy = req.userId
    data.commentedTo = req.userId;
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

exports.paidUnpaid = async (req, res) => {
  try {
    let data = req.body
    let claimId = data.claimIds
    let queryIds = { _id: { $in: claimId } };
    const updateBulk = await claimService.markAsPaid(queryIds, { claimPaymentStatus: 'Paid' }, { new: true })
    if (!updateBulk) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update!'
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }


}

exports.getMessages = async (req, res) => {
  // if (req.role != 'Super Admin') {
  //   res.send({
  //     code: constant.errorCode,
  //     message: 'Only super admin allow to do this action'
  //   })
  //   return
  // }
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
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
            }
          }
        ]

      }
    },
    { $unwind: { path: "$commentTo", preserveNullAndEmptyArrays: true } },
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
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              "roles.role": 1,
            }
          }
        ]
      }
    },
    { $unwind: { path: "$commentBy", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        date: 1,
        type: 1,
        messageFile: 1,
        content: 1,
        // "commentBy.firstName": 1,
        // "commentBy.lastName": 1
        "commentBy": 1,
        "commentTo": 1
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
      let contractId = result[i].contractId;
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
        // Update status for track status
        messageData.trackStatus = [
          {
            status: 'Completed',
            date: new Date()
          }
        ]
        updateStatus = await claimService.updateClaim({ _id: claimId }, {
          $push: messageData,
          $set: { claimFile: 'Completed', claimStatus: [{ status: 'Completed', date: new Date() }] }
        }, { new: true })
        const query = { contractId: new mongoose.Types.ObjectId(contractId) }
        let checkContract = await contractService.getContractById({ _id: contractId })
        let claimTotal = await claimService.checkTotalAmount(query);
        // Update Eligibilty true and false
        if (checkContract.productValue > claimTotal[0]?.amount) {
          const updateContract = await contractService.updateContract({ _id: contractId }, { eligibilty: true }, { new: true })
        }
        else if (checkContract.productValue < claimTotal[0]?.amount) {
          const updateContract = await contractService.updateContract({ _id: contractId }, { eligibilty: false }, { new: true })
        }
      }


      // await contractService.updateContract({ _id: contractId }, { eligibilty: true }, { new: true })
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