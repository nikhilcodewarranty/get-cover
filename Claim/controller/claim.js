const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const path = require("path");
const { claimStatus } = require("../model/claimStatus");
const { comments } = require("../model/comments");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const sgMail = require('@sendgrid/mail');
const moment = require("moment");
const LOG = require('../../User/model/logs')
sgMail.setApiKey(process.env.sendgrid_key);
const supportingFunction = require('../../config/supportingFunction')

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
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              trackingNumber: 1,
              trackingType: 1,
              claimType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
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
    let servicerMatch = {}
    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer.length > 0) {
        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
        //  servicerMatch = { 'servicerId': { $in: servicerIds } }
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
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      servicerMatch = { servicerId: new mongoose.Types.ObjectId(req.userId) }
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
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'claimPaymentStatus': { '$regex': data.claimPaidStatus ? data.claimPaidStatus : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            // { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
            // { "contracts.orders.resellerName": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        //const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        //selfServicer = item1.servicerId?.toString() === item1.servicerData?._id?.toString() && item1.servicerData?.isServicer ? true : false
        selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
        selfResellerServicer = item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString()

      }
      return {
        ...item1,
        servicerData: servicerName,
        selfResellerServicer: selfResellerServicer,
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

exports.getClaims = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 0
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
      } else {
        servicerIds.push("1111121ccf9d400000000000")
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
        orderIds = await getOrders.map(order => order.unique_key)
      }
    }
    let claimFilter = [
      { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { serial: { '$regex': data.serial ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
      { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
      { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
      { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
    ]

    let contractIds = []
    let contractFilterWithEligibilty = []
    let claimFilterQuery = []
    let contractCheck = 0
    if (data.contractId != "") {
      let getContractId = await contractService.findContracts({ unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      contractCheck = 1
      if (getContractId.length > 0) {
        contractIds = getContractId.map(ID => ID._id)
      } else {
        contractIds.push("1111121ccf9d400000000000")
      }
    }

    if (userSearchCheck == 1) {
      claimFilter.push({ orderId: { $in: orderIds } })
    }
    if (contractCheck == 1) {
      claimFilter.push({ contractId: { $in: contractIds } })
    }

    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.serial === "" && data.customerStatusValue && data.repairStatus === "" && data.claimStatus === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0 && contractCheck == 0) {
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
            $and: claimFilter
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

          ],
        },

      })
    }

    let getClaims = await claimService.getAllClaims(mainQuery)
    // res.json(getClaims);
    // return;
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaims,
      query: mainQuery
    })


  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message, err: err.stack
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
    // let match = {};
    // if (req.role == 'Dealer') {
    //   match = { 'dealerId': new mongoose.Types.ObjectId(req.userId) }
    // }
    // if (req.role == 'Customer') {
    //   match = { 'customerId': new mongoose.Types.ObjectId(req.userId) }
    // }
    let lookupCondition = [{ isDeleted: false }]
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0

    let orderIds = []
    let orderAndCondition = []
    let userSearchCheck = 0
    let customerIds = []
    let checkCustomer = 0
    if (data.customerName != "") {
      userSearchCheck = 1
      let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        customerIds = await getData.map(customer => customer._id)
      } else {
        customerIds.push("1111121ccf9d400000000000")
      }
    };
    if (req.role == 'Dealer') {
      userSearchCheck = 1
      orderAndCondition.push({ dealerId: { $in: [req.userId] } })
    }
    if (req.role == 'Reseller') {
      userSearchCheck = 1
      orderAndCondition.push({ resellerId: { $in: [req.userId] } })
    }
    if (req.role == 'Customer') {
      userSearchCheck = 1
      orderAndCondition.push({ customerId: { $in: [req.userId] } })
    }
    if (customerIds.length > 0) {
      orderAndCondition.push({ customerId: { $in: customerIds } })
    }
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order._id)
      }
      else {
        orderIds.push("1111121ccf9d400000000000")
      }
    }
    let contractFilter;
    if (data.contractId != "") {
      data.contractId = data.contractId.replace(/-/g, '')
    }

    // console.log("skldjfklsdjfslkjflksdjf", data.contractId)

    if (userSearchCheck == 1) {
      console.log("If")
      contractFilter = [
        { orderId: { $in: orderIds } },
        { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { "orderUniqueKey": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'serial': { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'unique_key_search': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
        // { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: 'Active' },
        { eligibilty: true }
      ]
    } else {
      console.log("rwerweewr")
      contractFilter = [
        // { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'venderOrder': { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { "orderUniqueKey": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'serial': { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { 'unique_key_search': { '$regex': data.contractId ? data.contractId : '', '$options': 'i' } },
        { status: 'Active' },
        { eligibilty: true }
      ]
    }

    console.log("check ak+++++++++++++++++++++++++++++++++++++")
    let query = [
      // { $sort: { unique_key_number: -1 } },
     
      {
        $match:
        {
          $and: contractFilter
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
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
                pipeline: [
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
              $project: {
                unique_key: 1,
                serial: 1,
                orderId: 1,
                "order.customers.username": 1,
                "order.unique_key": 1,
                "order.venderOrder": 1,
              }
            }
          ]
        }
      },

    ]
    console.log("check ak+++++++++++++++++++++++++++++++++++++",query)

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
//Get Unpaid claim value
exports.getUnpaidAmount = async (req, res, next) => {
  try {
    const ids = req.body.claimIds;
    const claimId = ids.map(id => new mongoose.Types.ObjectId(id))
    const response = await claimService.checkTotalAmount({ _id: { $in: claimId } });
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: {
        totalClaims: ids.length,
        unpaidValue: response[0]?.amount
      }
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
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
//add claim
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

    //Get Order Details by contract id

    const checkOrder = await orderService.getOrder({ _id: checkContract.orderId }, { isDeleted: false })

    let count = await claimService.getClaimCount();

    data.unique_key_number = count[0] ? count[0].unique_key_number + 1 : 100000
    data.unique_key_search = "CC" + "2024" + data.unique_key_number
    data.unique_key = "CC-" + "2024-" + data.unique_key_number
    data.orderId = checkOrder.unique_key
    data.venderOrder = checkOrder.venderOrder
    data.serial = checkContract.serial
    data.productName = checkContract.productName
    data.pName = checkContract?.pName
    data.dealerId = checkOrder.dealerId
    data.resellerId = checkOrder?.resellerId
    data.customerId = checkOrder.customerId
    data.model = checkContract.model
    data.manufacture = checkContract.manufacture

    data.serialNumber = checkContract.serial
    let claimResponse = await claimService.createClaim(data)
    if (!claimResponse) {
      let logData = {
        userId: req.userId,
        endpoint: "addClaim",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to add claim of this contract!",
          result: claimResponse
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to add claim of this contract!'
      });
      return
    }
    // Eligibility false when claim open
    const updateContract = await contractService.updateContract({ _id: data.contractId }, { eligibilty: false }, { new: true })
    //Save logs add claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/addClaim",
      body: data,
      response: {
        code: constant.successCode,
        message: 'Success!',
        result: claimResponse
      }
    }
    await LOG(logData).save()

    //Send notification to all
    let IDs = await supportingFunction.getUserIds()
    let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
    let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder?.resellerId, isPrimary: true })
    let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: data?.servicerId, isPrimary: true })
    if (resellerPrimary) {
      IDs.push(resellerPrimary._id)
    }
    if (servicerPrimary) {
      IDs.push(servicerPrimary._id)
    }
    IDs.push(customerPrimary._id)
    IDs.push(dealerPrimary._id)
    let notificationData1 = {
      title: "Add Claim",
      description: "The claim has been added",
      userId: req.teammateId,
      contentId: claimResponse._id,
      flag: 'claim',
      redirectionId: claimResponse.unique_key,
      notificationFor: IDs
    };
    let createNotification = await userService.createNotification(notificationData1);
    // Send Email code here
    let notificationCC = await supportingFunction.getUserEmails();
    let notificationTo = [customerPrimary?.email]
    //let cc = notificationEmails;
    notificationCC.push(dealerPrimary.email);
    notificationCC.push(resellerPrimary?.email);
    let emailData = {
      senderName: customerPrimary?.firstName,
      content: "The claim " + claimResponse.unique_key + " has been filed for the " + checkContract.unique_key + " contract!.",
      subject: 'Add Claim'
    }
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationTo, notificationCC, emailData))
    // Email to servicer and cc to admin 
    if (servicerPrimary) {
      emailData = {
        senderName: servicerPrimary?.firstName,
        content: "The claim " + claimResponse.unique_key + " has been filed for the " + checkContract.unique_key + " contract!.",
        subject: 'Add Claim'
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerPrimary?.email, notificationCC, emailData))
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: claimResponse
    })

  }
  catch (err) {
    //Save logs add claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/addClaim",
      body: req.body ? req.body : { 'type': "Catch" },
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message,
    })
  }
}
//Get contract by id
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
      console.log("+++++++++++++++++++++++++++++++++++++++", order[i], productsArray)
      productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
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
    if (checkClaim.claimFile == 'Open') {
      let contract = await contractService.getContractById({ _id: checkClaim.contractId });
      const query = { contractId: new mongoose.Types.ObjectId(checkClaim.contractId), claimFile: 'Completed' }
      let claimTotal = await claimService.checkTotalAmount(query);
      if (claimTotal.length > 0) {
        const remainingValue = contract.productValue - claimTotal[0]?.amount
        if (remainingValue.toFixed(2) < data.totalAmount) {
          res.send({
            code: constant.errorCode,
            message: 'Claim Amount Exceeds Contract Retail Price'
          });
          return;
        }
      }
      if (contract.productValue < data.totalAmount) {
        res.send({
          code: constant.errorCode,
          message: 'Claim Amount Exceeds Contract Retail Price'
        });
        return;
      }
      let option = { new: true }
      let updateData = await claimService.updateClaim(criteria, data, option)
      if (!updateData) {
        //Save Logs edit claim
        let logData = {
          userId: req.userId,
          endpoint: "claim/editClaim",
          body: data,
          response: {
            code: constant.errorCode,
            message: 'Failed to process your request!',
            result: updateData
          }
        }
        await LOG(logData).save()
        res.send({
          code: constant.errorCode,
          message: "Failed to process your request."
        })
        return;
      }
      //Send notification to all
      let IDs = await supportingFunction.getUserIds()
      let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkClaim?.servicerId, isPrimary: true })
      if (servicerPrimary) {
        IDs.push(servicerPrimary._id)
      }
      let notificationData1 = {
        title: "Repair Parts/ labor update",
        description: "The  repair part update for " + checkClaim.unique_key + " claim",
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        redirectionId: checkClaim.unique_key,
        notificationFor: IDs
      };
      let createNotification = await userService.createNotification(notificationData1);

      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      //notificationEmails.push(servicerPrimary?.email);
      const servicerEmail = servicerPrimary ? servicerPrimary?.email : process.env.servicerEmail
      let emailData = {
        senderName: servicerPrimary ? servicerPrimary.firstName : '',
        content: "The  repair part update for " + checkClaim.unique_key + " claim",
        subject: "Repair Part Update"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, notificationEmails, emailData))
      res.send({
        code: constant.successCode,
        message: "Updated successfully"
      })
      return;
    }
    //Save Logs edit claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaim",
      body: data,
      response: {
        code: constant.successCode,
        message: 'Updated successfully',
        result: updateData
      }
    }
    await LOG(logData).save()


    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
    //Save Logs edit claim
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaim catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.editClaimType = async (req, res) => {
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
    if (checkClaim.claimFile == 'Open') {
      let option = { new: true }
      let updateData = await claimService.updateClaim(criteria, data, option)
      if (!updateData) {
        //Save logs 

        let logData = {
          userId: req.userId,
          endpoint: "claim/editClaimType",
          body: data,
          response: {
            code: constant.errorCode,
            message: "Failed to process your request.",
            result: updateData
          }
        }
        await LOG(logData).save()

        res.send({
          code: constant.errorCode,
          message: "Failed to process your request."
        })
        return;
      }
      //Save logs 
      let logData = {
        userId: req.userId,
        endpoint: "claim/editClaimType",
        body: data,
        response: {
          code: constant.successCode,
          message: "Updated successfully",
          result: updateData
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.successCode,
        result: updateData,
        message: "Updated successfully",
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
    // Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimType catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
// Claim Paid and unpaid api
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

    const checkOrder = await orderService.getOrder({ _id: checkContract.orderId }, { isDeleted: false })

    let claimTotal = await claimService.checkTotalAmount(query);
    let status = {};
    let updateData = {};
    if (data.hasOwnProperty("customerStatus")) {
      if (data.customerStatus == 'Product Received') {
        let option = { new: true }
        let claimStatus = await claimService.updateClaim(criteria, { claimFile: 'Completed', claimDate: new Date() }, option)
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

      //Send notification to all
      let IDs = await supportingFunction.getUserIds()
      let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
      let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder?.resellerId, isPrimary: true })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkClaim?.servicerId, isPrimary: true })
      if (resellerPrimary) {
        IDs.push(resellerPrimary._id)
      }
      if (servicerPrimary) {
        IDs.push(servicerPrimary._id)
      }
      IDs.push(customerPrimary._id)
      IDs.push(dealerPrimary._id)
      let notificationData1 = {
        title: "Customer Status Update",
        description: "The customer status has been updated for " + checkClaim.unique_key + "",
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        redirectionId: checkClaim.unique_key,
        notificationFor: IDs
      };
      let createNotification = await userService.createNotification(notificationData1);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      //  notificationEmails.push(servicerPrimary?.email);
      //Email to customer
      let emailData = {
        senderName: customerPrimary?.firstName,
        content: "The customer status has been updated for " + checkClaim.unique_key + "",
        subject: "Customer Status Update"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(customerPrimary.email, notificationEmails, emailData))
      //Email to dealer
      emailData = {
        senderName: dealerPrimary?.firstName,
        content: "The customer status has been updated for " + checkClaim.unique_key + "",
        subject: "Customer Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
      //Email to Reseller
      emailData = {
        senderName: resellerPrimary?.firstName,
        content: "The customer status has been updated for " + checkClaim.unique_key + "",
        subject: "Customer Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : process.env.resellerEmail, notificationEmails, emailData))
      const servicerEmail = servicerPrimary ? servicerPrimary?.email : process.env.servicerEmail
      emailData = {
        senderName: servicerPrimary?.firstName,
        content: "The customer status has been updated for " + checkClaim.unique_key + "",
        subject: "Customer Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, notificationEmails, emailData))

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
      //Send notification to all
      let IDs = await supportingFunction.getUserIds()
      let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
      let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder?.resellerId, isPrimary: true })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkClaim?.servicerId, isPrimary: true })
      if (resellerPrimary) {
        IDs.push(resellerPrimary._id)
      }
      if (servicerPrimary) {
        IDs.push(servicerPrimary._id)
      }
      IDs.push(customerPrimary._id)
      IDs.push(dealerPrimary._id)
      let notificationData1 = {
        title: "Repair Status Update",
        description: "The repair status has been updated for " + checkClaim.unique_key + "",
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        redirectionId: checkClaim.unique_key,
        notificationFor: IDs
      };
      console.log("notificationData1--------------------------", notificationData1)
      let createNotification = await userService.createNotification(notificationData1);
      console.log("createNotification--------------------------", createNotification)
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      let toEmail = []
      //Email to dealer
      let emailData = {
        senderName: dealerPrimary.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Repair Status Update"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, notificationEmails, emailData))
      // Email to Customer
      emailData = {
        senderName: customerPrimary?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Repair Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(customerPrimary.email, notificationEmails, emailData))
      // Email to Reseller
      emailData = {
        senderName: resellerPrimary?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Repair Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary ? resellerPrimary.email : 'reseller@yopmail.com', notificationEmails, emailData))
      emailData = {
        senderName: servicerPrimary?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Repair Status Update"
      }
      const servicerEmail = servicerPrimary ? servicerPrimary?.email : process.env.servicerEmail
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerEmail, notificationEmails, emailData))
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

      //Send notification to all
      let IDs = await supportingFunction.getUserIds()
      const admin = await supportingFunction.getPrimaryUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true });
      let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.dealerId, isPrimary: true })
      let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder.customerId, isPrimary: true })
      let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkOrder?.resellerId, isPrimary: true })
      let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkClaim?.servicerId, isPrimary: true })
      if (resellerPrimary) {
        IDs.push(resellerPrimary._id)
      }
      if (servicerPrimary) {
        IDs.push(servicerPrimary._id)
      }
      IDs.push(customerPrimary._id)
      IDs.push(dealerPrimary._id)
      let notificationData1 = {
        title: "Claim Status Update",
        description: "The claim status has been updated for " + checkClaim.unique_key + "",
        userId: req.teammateId,
        contentId: checkClaim._id,
        flag: 'claim',
        redirectionId: checkClaim.unique_key,
        notificationFor: IDs
      };
      let createNotification = await userService.createNotification(notificationData1);
      // Send Email code here
      let notificationEmails = await supportingFunction.getUserEmails();
      //Email to dealer
      let emailData = {
        senderName: dealerPrimary.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Claim Status Update"
      }
      let mailing = sgMail.send(emailConstant.sendEmailTemplate(dealerPrimary.email, ['yash@yopmail.com'], emailData))
      //Email to Reseller
      emailData = {
        senderName: resellerPrimary?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Claim Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(resellerPrimary?.email, ['yash@yopmail.com'], emailData))
      //Email to customer
      emailData = {
        senderName: customerPrimary.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Claim Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(customerPrimary?.email, ['yash@yopmail.com'], emailData))
      //Email to customer
      emailData = {
        senderName: servicerPrimary?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Claim Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(servicerPrimary?.email, ['yash@yopmail.com'], emailData))
      //Email to admin
      emailData = {
        senderName: admin?.firstName,
        content: "The claim status has been updated for " + checkClaim.unique_key + "",
        subject: "Claim Status Update"
      }
      mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ['yash@yopmail.com'], emailData))
    }
    if (data.hasOwnProperty("claimType")) {
      let claimType = await claimService.updateClaim(criteria, { claimType: data.claimType }, { new: true })
    }
    // Keep history of status in mongodb 
    let updateStatus = await claimService.updateClaim(criteria, { $push: status }, { new: true })

    // Update every status 
    let updateBodyStatus = await claimService.updateClaim(criteria, updateData, { new: true })
    if (!updateStatus) {
      //Save logs
      let logData = {
        userId: req.userId,
        endpoint: "claim/editClaimStatus",
        body: data,
        response: {
          code: constant.errorCode,
          message: 'Unable to update status!',
          result: updateBodyStatus
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to update status!'
      })
      return;
    }
    //Eligibility true when claim is completed and rejected
    if (updateBodyStatus.claimFile == 'Completed' || updateBodyStatus.claimFile == 'Rejected') {
      if (checkContract.productValue > claimTotal[0]?.amount) {
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: true }, { new: true })
      }
      else if (checkContract.productValue < claimTotal[0]?.amount) {
        const updateContract = await contractService.updateContract({ _id: checkClaim.contractId }, { eligibilty: false }, { new: true })
      }
    }
    //Amount reset of the claim in rejected claim
    if (updateBodyStatus.claimFile == 'Rejected') {
      let updatePrice = await claimService.updateClaim(criteria, { totalAmount: 0 }, { new: true })
    }
    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimStatus",
      body: data,
      response: {
        code: constant.successCode,
        result: updateBodyStatus
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateBodyStatus
    })

  } catch (err) {
    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "claim/editClaimStatus catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()

    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
//Edit servicer
exports.editServicer = async (req, res) => {
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
    if (req.body.servicerId == "") {
      req.body.servicerId = null
    }
    if (req.body.servicerId != "") {
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
    }



    // console.log('claimId',req.params.claimId)
    // console.log('servicerId',req.body.servicerId);
    // return

    let updateServicer = await claimService.updateClaim({ _id: req.params.claimId }, data, { new: true })
    console.log(updateServicer)
    if (!updateServicer) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "editServicer/:claimId",
        body: data,
        response: {
          code: constant.errorCode,
          message: 'Unable to update servicer!'
        }
      }
      await LOG(logData).save()
      res.send({
        code: constant.errorCode,
        message: 'Unable to update servicer!'
      })
      return;
    }
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "editServicer/:claimId",
      body: data,
      response: {
        code: constant.successCode,
        message: updateServicer
      }
    }
    await LOG(logData).save()
    //send notification to admin and dealer 
    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.body.servicerId, isPrimary: true })
    if (getPrimary) {
      IDs.push(getPrimary._id)

    }
    let notificationData = {
      title: "Servicer Updated",
      description: "The servicer has been updated for the claim " + checkClaim.unique_key + "",
      userId: req.teammateId,
      contentId: null,
      flag: 'claim',
      redirectionId: checkClaim.unique_key,
      notificationFor: IDs
    };
    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    // notificationEmails.push(getPrimary.email);
    let emailData = {
      senderName: getPrimary ? getPrimary.firstName : "",
      content: "The servicer has been updated for the claim " + checkClaim.unique_key + "",
      subject: "Servicer Update"
    }
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(getPrimary ? getPrimary.email : process.env.servicerEmail, notificationEmails, emailData))
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateServicer
    })

  }
  catch (err) {
    //Save logs
    let logData = {
      userId: req.userId,
      endpoint: "editServicer catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        result: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }

}
//Save bulk claim
exports.saveBulkClaim = async (req, res) => {
  uploadP(req, res, async (err) => {
    try {
      let data = req.body
       const emailField = req.body.email;

      // // // Parse the email field
      const emailArray = JSON.parse(emailField);
      // if (req.role != 'Super Admin') {
      //   res.send({
      //     code: constant.errorCode,
      //     message: 'Only super admin allow to do this action!'
      //   });
      //   return
      // }
      // console.log(req.files[0].path); return;
      let existDealerId = {
        data: {}
      };
      let existCustomerId = {
        data: {}
      };
      let match = {}
      if (req.role == 'Dealer') {

        match = { "order.dealer._id": new mongoose.Types.ObjectId(req.userId) }
      }
      if (req.role == 'Reseller') {
        match = { "order.reseller._id": new mongoose.Types.ObjectId(req.userId) }
      }
      if (req.role == 'Customer') {
        match = { "order.customers._id": new mongoose.Types.ObjectId(req.userId) }
      }
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
      let totalDataComing = totalDataComing1.map((item, i) => {
        const keys = Object.keys(item);
        let dateLoss = item[keys[2]]
        return {
          contractId: item[keys[0]],
          servicerName: item[keys[1]],
          lossDate: dateLoss.toString(),
          diagnosis: item[keys[3]],
          duplicate: false,
          exit: false
        };
      });

      if (totalDataComing.length === 0) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file!"
        });
        return;
      }
      totalDataComing = totalDataComing.map((item, i) => {
        return {
          contractId: item.contractId?.toString().replace(/\s+/g, ' ').trim(),
          servicerName: item.servicerName?.toString().replace(/\s+/g, ' ').trim(),
          lossDate: item.lossDate?.toString().replace(/\s+/g, ' ').trim(),
          diagnosis: item.diagnosis?.toString().replace(/\s+/g, ' ').trim(),
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
        // data.lossDate = data.lossDate.split('-').join('/');
        const formats = [
          'MM/DD/YYYY',
          'MM-DD-YYYY'
        ]
        let formatDate = formats.some(format => moment(data.lossDate, format, true).isValid())
        console.log(data.lossDate)
        console.log(moment(data.lossDate))

        if (!moment(data.lossDate).isValid()) {
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
          unique_key: item.contractId.toUpperCase()
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
      const servicerArray = await Promise.all(servicerArrayPromise);

      // console.log(servicerArray);return;
      //check claim is already open by contract id
      // const claimArrayPromise = totalDataComing.map(item => {
      //   console.log("item------------------------",item)
      //   if (!item.exit) return claimService.getClaims({
      //     claimFile: 'Open'
      //   });
      //   else {
      //     return null;
      //   }
      // })
      const claimArray = await claimService.getClaims({
        claimFile: 'Open'
      });

      // res.json(claimArray);
      // return;

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
                      from: "customers",
                      localField: "customerId",
                      foreignField: "_id",
                      as: "customers"
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
              $match: match
            },
            {
              $project: {
                orderId: 1,
                "order.dealerId": 1,
                "order.customerId": 1,
                "order._id": 1,
                "order.unique_key": 1,
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
            { $unwind: { path: "$order.customers", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$order.servicer", preserveNullAndEmptyArrays: true } },
          ]
          return contractService.getAllContracts2(query)
        }
        else {
          return null;
        }
      })
      const contractAllDataArray = await Promise.all(contractAllDataPromise)
      // res.json(contractAllDataArray);

      // return;

      //Filter data which is contract , servicer and not active
      totalDataComing.forEach((item, i) => {
        if (!item.exit) {
          const contractData = contractArray[i];
          const servicerData = servicerArray[i]
          const allDataArray = contractAllDataArray[i];
          const claimData = claimArray;
          let flag;
          item.contractData = contractData;
          item.servicerData = servicerData;
          item.orderData = allDataArray[0]
          if (!contractData || allDataArray.length == 0) {
            item.status = "Contract not found"
            item.exit = true;
          }
          if (contractData && new Date(contractData?.coverageStartDate) > new Date(item.lossDate)) {
            item.status = "Loss date should be in between coverage start date and present date!"
            item.exit = true;
          }
          if (item.contractData && claimData != null && claimData.length > 0) {
            const filter = claimData.filter(claim => claim.contractId?.toString() === item.contractData?._id.toString())
            if (filter.length > 0) {
              item.status = "Claim is already open of this contract"
              item.exit = true;
            }
          }

          if (allDataArray.length > 0 && servicerData) {
            flag = false;
            if (allDataArray[0]?.order.dealer.dealerServicer.length > 0) {
              //Find Servicer with dealer Servicer
              const servicerCheck = allDataArray[0]?.order.dealer.dealerServicer.find(item => item.servicerId?.toString() === servicerData._id?.toString())
              if (servicerCheck) {
                flag = true
              }
            }
            //Check dealer itself servicer
            if (allDataArray[0]?.order.dealer?.isServicer && allDataArray[0]?.order.dealer?.accountStatus && allDataArray[0]?.order.dealer._id?.toString() === servicerData.dealerId?.toString()) {
              flag = true
            }

            if (allDataArray[0]?.order.reseller?.isServicer && allDataArray[0]?.order.reseller?.status && allDataArray[0]?.order.reseller?._id.toString() === servicerData.resellerId?.toString()) {
              flag = true
            }
          }
          if ((item.servicerName != '' && !servicerData)) {
            flag = false
          }

          if ((!flag && flag != undefined)) {
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
      let emailServicerId = [];
      let emailDealerId = [];
      totalDataComing.map((data, index) => {
        let servicerId = data.servicerData?._id
        if (data.servicerData?.dealerId) {
          servicerId = data.servicerData?.dealerId
        }
        if (data.servicerData?.resellerId) {
          servicerId = data.servicerData?.resellerId
        }
        emailServicerId.push(servicerId);
        emailDealerId.push(data.orderData?.order?.dealerId);
        if (!data.exit) {
          let obj = {
            contractId: data.contractData._id,
            servicerId: servicerId,
            orderId: data.orderData?.order?.unique_key,
            dealerId: data.orderData?.order?.dealerId,
            resellerId: data.orderData?.order?.resellerId,
            customerId: data.orderData?.order?.customerId,
            venderOrder: data.contractData.venderOrder,
            serial: data.contractData.serial,
            productName: data.contractData.productName,
            pName: data.contractData.pName,
            model: data.contractData.model,
            manufacture: data.contractData.manufacture,
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
      let IDs = await supportingFunction.getUserIds()
      let adminEmail = await supportingFunction.getUserEmails();
      //get email of all servicer
      const emailServicer = await userService.getMembers({ accountId: { $in: emailServicerId }, isPrimary: true }, {})
      //get email of dealers and send email 
      if (req.role == 'Dealer') {
        const emailDealer = await userService.getMembers({ accountId: { $in: emailDealerId }, isPrimary: true }, {})
        IDs = IDs.concat(emailDealerId)
        totalDataComing.map((data, i) => {
          let dealerId = data.orderData?.order?.dealerId;
          if (!existDealerId.data[dealerId]) {
            existDealerId.data[dealerId] = [];
          }
          existDealerId.data[dealerId].push({
            contractId: data.contractId ? data.contractId : "",
            lossDate: data.lossDate ? data.lossDate : '',
            diagnosis: data.diagnosis ? data.diagnosis : '',
            status: data.status ? data.status : '',
          });

        });
        let flatDealerArray = [];
        for (let dealerId in existDealerId.data) {
          let matchData = emailServicer.find(matchServicer => matchServicer.accountId.toString() === dealerId.toString());
          let email = matchData ? matchData.email : dealerId; // Replace servicerId with email if matchData is found
          flatDealerArray.push({
            email: email,
            response: existDealerId.data[dealerId]
          });
        }
        //send email to servicer      
        for (const item of flatDealerArray) {
          const htmtToString = convertArrayToHTMLTable(item.response);
          let mailing_dealer = await sgMail.send(emailConstant.sendCsvFile(item.email, adminEmail, htmtToString));
        }

      }
      //Build data for particular servicer and send mail
      let existArray = {
        data: {}
      };

      totalDataComing.map((data, i) => {
        let servicerId = data.servicerData?._id;
        if (data.servicerData?.dealerId) {
          servicerId = data.servicerData?.dealerId;
        }
        if (data.servicerData?.resellerId) {
          servicerId = data.servicerData?.resellerId;
        }

        if (!existArray.data[servicerId]) {
          existArray.data[servicerId] = [];
        }
        existArray.data[servicerId].push({
          contractId: data.contractId ? data.contractId : "",
          lossDate: data.lossDate ? data.lossDate : '',
          diagnosis: data.diagnosis ? data.diagnosis : '',
          status: data.status ? data.status : '',
        });

      });
      // If you need to convert existArray.data to a flat array format

      if (emailServicer.length > 0) {
        IDs = IDs.concat(emailServicerId)
        let flatArray = [];
        for (let servicerId in existArray.data) {
          let matchData = emailServicer.find(matchServicer => matchServicer.accountId.toString() === servicerId.toString());
          let email = matchData ? matchData.email : servicerId; // Replace servicerId with email if matchData is found
          flatArray.push({
            email: email,
            response: existArray.data[servicerId]
          });
        }
        //send email to servicer      
        for (const item of flatArray) {
          const htmlTableString = convertArrayToHTMLTable(item.response);
          let mailing_servicer = await sgMail.send(emailConstant.sendCsvFile(item.email, adminEmail, htmlTableString));
        }
      }
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

      let new_admin_array = adminEmail.concat(emailArray)

      //send Email to admin 

      let mailing = sgMail.send(emailConstant.sendCsvFile(new_admin_array, ['ram@yopmail.com'], htmlTableString));

      if (saveBulkClaim.length > 0) {

        let notificationData1 = {
          title: "Bulk Report",
          description: "The Bulk claim file has been registered!",
          userId: req.teammateId,
          flag: 'Bulk Claim',
          notificationFor: IDs
        };
        let createNotification = await userService.createNotification(notificationData1);
      }

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

//Send message
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
    let emailTo;
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
    data.commentedByUser = req.teammateId
    emailTo = await supportingFunction.getPrimaryUser({ _id: req.teammateId, isPrimary: true })
    if (data.type == 'Reseller') {
      data.commentedTo = orderData.resellerId
      emailTo = await supportingFunction.getPrimaryUser({ accountId: orderData.resellerId, isPrimary: true })
    }
    else if (data.type == 'Dealer') {
      data.commentedTo = orderData.dealerId
      emailTo = await supportingFunction.getPrimaryUser({ accountId: orderData.dealerId, isPrimary: true })
    }
    else if (data.type == 'Customer') {
      data.commentedTo = orderData.customerId
      emailTo = await supportingFunction.getPrimaryUser({ accountId: orderData.customerId, isPrimary: true })
    }
    else if (data.type == 'Servicer') {
      data.commentedTo = orderData.servicerId
      emailTo = await supportingFunction.getPrimaryUser({ accountId: checkClaim.servicerId, isPrimary: true })
    }

    let sendMessage = await claimService.addMessage(data)

    if (!sendMessage) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "sendMessages",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to send message",
          result: sendMessage
        }
      }
      await LOG(logData).save()

      res.send({
        code: constant.errorCode,
        message: 'Unable to send message!'
      });
      return;
    }
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "sendMessages",
      body: data,
      response: {
        code: constant.successCode,
        messages: 'Message Sent!',
        result: sendMessage
      }
    }
    await LOG(logData).save()

    //Send notification to all
    let IDs = await supportingFunction.getUserIds()
    let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: orderData.dealerId, isPrimary: true })
    let customerPrimary = await supportingFunction.getPrimaryUser({ accountId: orderData.customerId, isPrimary: true })
    let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: orderData?.resellerId, isPrimary: true })
    let servicerPrimary = await supportingFunction.getPrimaryUser({ accountId: orderData?.servicerId, isPrimary: true })
    if (resellerPrimary) {
      IDs.push(resellerPrimary._id)
    }
    if (servicerPrimary) {
      IDs.push(servicerPrimary._id)
    }
    IDs.push(customerPrimary._id)
    IDs.push(dealerPrimary._id)
    let notificationData1 = {
      title: "Message sent",
      description: "The one new message for " + checkClaim.unique_key + "",
      userId: req.teammateId,
      contentId: checkClaim._id,
      flag: 'claim',
      redirectionId: checkClaim.unique_key,
      notificationFor: IDs
    };
    let createNotification = await userService.createNotification(notificationData1);

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    // notificationEmails.push(emailTo.email);
    let emailData = {
      senderName: emailTo?.firstName,
      content: "The new message for " + checkClaim.unique_key + " claim",
      subject: "New Message"
    }
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(emailTo ? emailTo?.email : process.env.servicerEmail, notificationEmails, emailData))
    res.send({
      code: constant.successCode,
      messages: 'Message Sent!',
      result: sendMessage
    })

  }
  catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "sendMessages catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.successCode,
        result: err.message
      }
    }
    await LOG(logData).save()
    res.send({
      code: constant.errorCode,
      messages: err.message
    })
  };
}
//Get messages
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
                { isPrimary: true },
                { metaId: { $ne: null } }
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
        localField: "commentedByUser",
        foreignField: "_id",
        as: "commentBy",
        pipeline: [
          // {
          //   $match:
          //   {
          //     $and: [
          //       { isPrimary: true }
          //     ]
          //   },
          // },
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
    // {
    //   $lookup: {
    //     from: "users",
    //     localField: "commentedByUser",
    //     foreignField: "_id",
    //     as: "commentedByUser",
    //     pipeline: [
    //       {
    //         $project: {
    //           firstName: 1,
    //           lastName: 1,
    //           email: 1,
    //           _id: 1
    //         }
    //       }
    //     ]
    //   }
    // },
    //  { $unwind: { path: "$commentedByUser", preserveNullAndEmptyArrays: true } },
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
        "commentTo": 1,
        // "commentedByUser": 1,

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
//Automatic completed when servicer shipped after 7 days cron job
exports.statusClaim = async (req, res) => {
  try {
    const result = await claimService.getClaims({
      'repairStatus.status': 'Servicer Shipped',
    });
    console.log("statusClaim----------------------------",);
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

      sevenDaysAfterShippedDate.setDate(sevenDaysAfterShippedDate.getHours() + 1);

      // console.log("sevenDaysAfterShippedDate-------------------------",sevenDaysAfterShippedDate);
      // return;

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
          $set: { claimFile: 'Completed', claimDate: new Date(), claimStatus: [{ status: 'Completed', date: new Date() }] }
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

exports.getCoverageType = async (req, res) => {
  try {
    const checkContract = await contractService.getContractById({ _id: req.params.contractId });
    if (!checkContract) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find Contract!"
      });
      return
    }
    const query = { _id: new mongoose.Types.ObjectId(checkContract.orderId) }

    const orderData = await orderService.getOrder(query, { isDeleted: false })

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: checkOrder
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// exports.searchClaim = async (req, res) => {
//   try {
//     let data = req.body
//     let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//     let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//     let limitData = Number(pageLimit)
//     let dealerIds = [];
//     let customerIds = [];
//     let userSearchCheck = 0
//     if (req.role == 'Dealer') {
//       userSearchCheck = 1
//       let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//       if (getData.length > 0) {
//         dealerIds = await getData.map(dealer => dealer._id)
//       } else {
//         dealerIds.push("1111121ccf9d400000000000")
//       }
//     };
//     if (req.role == 'Customer') {
//       userSearchCheck = 1
//       let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//       if (getData.length > 0) {
//         customerIds = await getData.map(customer => customer._id)
//       } else {
//         customerIds.push("1111121ccf9d400000000000")
//       }
//     };
//     if (data.customerName != "") {
//       userSearchCheck = 1
//       let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//       if (getData.length > 0) {
//         customerIds = await getData.map(customer => customer._id)
//       } else {
//         customerIds.push("1111121ccf9d400000000000")
//       }
//     };
//     let orderAndCondition = []

//     if (dealerIds.length > 0) {
//       orderAndCondition.push({ dealerId: { $in: dealerIds } })
//     }
//     if (customerIds.length > 0) {
//       orderAndCondition.push({ customerId: { $in: customerIds } })
//     }
//     let orderIds = []
//     if (orderAndCondition.length > 0) {
//       let getOrders = await orderService.getOrders({
//         $and: orderAndCondition
//       })
//       if (getOrders.length > 0) {
//         orderIds = await getOrders.map(order => order._id)
//       }
//     }
//     let contractFilterWithEligibilty = []
//     contractFilterWithEligibilty = [
//       // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//       { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       { status: 'Active' },
//       { eligibilty: true }
//     ]


//     if (userSearchCheck == 1) {
//       contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
//     }
//     let mainQuery = []
//     console.log(orderIds)
//     if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
//       mainQuery = [
//         { $sort: { unique_key_number: -1 } },
//         {
//           $facet: {
//             totalRecords: [
//               {
//                 $count: "total"
//               }
//             ],
//             data: [
//               {
//                 $skip: skipLimit
//               },
//               {
//                 $limit: pageLimit
//               },
//               {
//                 $project: {
//                   productName: 1,
//                   model: 1,
//                   serial: 1,
//                   unique_key: 1,
//                   status: 1,
//                   manufacture: 1,
//                   eligibilty: 1,
//                   orderUniqueKey: 1,
//                   venderOrder: 1,
//                   totalRecords: 1
//                 }
//               }
//             ],
//           },

//         },
//       ]
//     } else {
//       mainQuery = [
//         { $sort: { unique_key_number: -1 } },
//         {
//           $match:
//           {
//             $and: contractFilterWithEligibilty
//           },
//         },
//       ]
//       mainQuery.push({
//         $facet: {
//           totalRecords: [
//             {
//               $count: "total"
//             }
//           ],
//           data: [
//             {
//               $skip: skipLimit
//             },
//             {
//               $limit: pageLimit
//             },
//             {
//               $project: {
//                 productName: 1,
//                 model: 1,
//                 serial: 1,
//                 unique_key: 1,
//                 status: 1,
//                 manufacture: 1,
//                 eligibilty: 1,
//                 orderUniqueKey: 1,
//                 venderOrder: 1,
//                 totalRecords: 1
//               }
//             }
//           ],
//         },

//       })
//     }


//     // console.log("sssssss", contractFilterWithPaging)

//     let getContracts = await contractService.getAllContracts2(mainQuery, { maxTimeMS: 100000 })
//     let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

//     res.send({
//       code: constant.successCode,
//       message: "Success",
//       result: getContracts[0]?.data ? getContracts[0]?.data : [],
//       totalCount,
//      //mainQuery
//     })

//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }