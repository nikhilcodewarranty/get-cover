const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const path = require("path");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
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
    let lookupQuery = [
      {
        $match:
        {
          $and: [
            { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
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
            { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
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
            { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
          ]
        }
      },
    ]

    let allClaims = await claimService.getAllClaims(lookupQuery);
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
            { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { status: 'Active' }
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

      console.log('ile++++++++++++++++++++++++=', file)

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
    console.log(claimTotal)
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

    let status = []
    if (data.hasOwnProperty("customerStatus")) {
      data.customerStatus = [
        {
          status: data.customerStatus
        }
      ]
      if (data.customerStatus == 'Product Received') {
        let option = { new: true }
        let claimStatus = await claimService.updateClaim(criteria, { claimFile: 'Completed' }, option)
        data.claimStatus = [
          {
            status: data.customerStatus
          }
        ]
      }

    }
    if (data.hasOwnProperty("repairStatus")) {
      data.repairStatus = [
        {
          status: data.repairStatus
        }
      ]
    }
    if (data.hasOwnProperty("claimStatus")) {
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
      const fileUrl = req.files[0].path
      const wb = XLSX.readFile(fileUrl);
      const sheets = wb.SheetNames;
      const ws = wb.Sheets[sheets[0]];
      let message = [];
      let checkDuplicate = [];
      const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], { defval: "" });
      const totalDataComing = totalDataComing1.map((item) => {
        const keys = Object.keys(item);
        return {
          contractId: item[keys[0]],
          servicerName: item[keys[1]],
          lossDate: item[keys[2]],
          diagnosis: item[keys[3]],
          duplicate: [],
          exit: false
        };
      });
      //check Contract Id exist or not in the array
      for (let i = 0; i < totalDataComing.length; i++) {
        if (totalDataComing[i].contractId == '' || totalDataComing[i].contractId == undefined) {
          totalDataComing[i].exit = true;
          totalDataComing[i].status = 'The Contract id is empty'
        }
        if (totalDataComing[i].lossDate == '' || totalDataComing[i].contractId == undefined) {
          totalDataComing[i].exit = true;
          totalDataComing[i].status = 'The last date is empty'
        }
        if (totalDataComing[i].diagnosis == '' || totalDataComing[i].contractId == undefined) {
          totalDataComing[i].exit = true;
          totalDataComing[i].status = 'The dignosis is empty'
        }

      }
      res.send({
        code: constant.successCode,
        message: 'Success!',
        totalDataComing
      })

      return;

      // const totalDataComing = [
      //   {
      //     contractId: 'OC-2024-100000',
      //     servicerName: '3122',
      //     lossDate: '03-03-2024',
      //     diagnosis: 'new'
      //   },
      //   {
      //     contractId: 'OC-2024-100000',
      //     servicerName: 'yashDealer',
      //     lossDate: '03-03-2024',
      //     diagnosis: 'dsdsdfs'
      //   }
      // ]

      var today = new Date();
      totalDataComing.map((data, index) => {
        var compareDate = new Date(data.lossDate)
        if (data.contractId == '' || data.lossDate == '' || data.diagnosis == '') {
          let obj = {
            code: constant.errorCode,
            message: 'Contract Id, loss date and diagnosis should not empty!'
          }
          message.push(obj)
          return;
        }
        else if (compareDate > today) {
          let obj = {
            code: constant.errorCode,
            message: 'Loss date should not be future'
          }
          message.push(obj)
          return;
        }
      })
      if (message.length > 0) {
        res.send({
          message
        })
        return
      }


      res.send({
        code: constant.successCode,
        message: 'Success!',
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

    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let query = [
      {
        $match: { _id: new mongoose.Types.ObjectId(checkClaim.contractId) },
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
    let commentedBy = 'Admin';
    let getData = await contractService.getContracts(query, skipLimit, pageLimit)
    if (req.role == 'Dealer') {
      const dealerData = await dealerService.getDealerById(req.userId, { isDeleted: false })
      commentedBy = dealerData.name
    }
    if (req.role == 'Customer') {
      const customerData = await customerService.getCustomerById({ _id: req.userId }, { isDeleted: false })
      commentedBy = customerData.username
    }
    if (req.role == 'Servicer') {
      const servicerData = await servicerService.getServiceProviderById({ _id: req.userId }, { isDeleted: false })
      commentedBy = servicerData.name
    }
    if (req.role == 'Reseller') {
      const resellerData = await resellerService.getReseller({ _id: req.userId }, { isDeleted: false })
      commentedBy = resellerData.name
    }
    let commentedTo = 'Admin';
    if (getData.length > 0) {
      if (data.type == 'Reseller') {
        commentedTo = getData[0]?.order[0]?.reseller[0]?.name
      }
      else if (data.type == 'Dealer') {
        commentedTo = getData[0]?.order[0]?.dealer[0]?.name
      }
      else if (data.type == 'Customer') {
        commentedTo = getData[0]?.order[0]?.customer[0]?.username
      }
      else if (data.type == 'Servicer') {
        commentedTo = getData[0]?.order[0]?.servicer[0]?.name
      }
      else if (data.type == 'Dealer') {
        commentedTo = getData[0]?.order[0]?.dealer[0]?.name
      }
    }
    let messageData = {};
    let messages = [
      {
        type: data.type,
        commentedBy: commentedBy,
        commentedTo: commentedTo,
        content: data.content ? data.content : '',
        messageFile: {
          "originalname": "Add Product Format - Sheet1 (another copy).csv",
          "fileName": "file-1709656484491.csv",
          "size": 180
        },
        content: data.content

      }
    ]


    messageData.comments = messages

    // console.log(messageData); return



    let updateMessage = await claimService.updateClaim(criteria, { $push: messageData }, { new: true })
    if (!updateMessage) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to send message!'
      });
      return;
    }

    res.send({
      code: constant.successCode,
      messages: 'Message Sent!',
      result: updateMessage
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      messages: err.message
    })
  };
}

exports.statusClaim = async (req, res) => {
  try {
    const result = await claimService.getClaims({
      'repairStatus.status': 'Servicer Shipped',
    });
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

      console.log("customerLastResponseDate===================", customerLastResponseDate)

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
      let updateStatus = await claimService.updateClaim({ _id: claimId }, {
        $push: messageData,
        $set: { claimFile: 'Completed' }
      }, { new: true })
    }


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
    const product = contract.productValue ? contract.productValue : 0
    res.send({
      code:constant.successCode,
      message:'Success!',
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