const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const path = require("path");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const contractService = require("../../Contract/services/contractService");
const multer = require("multer");
const constant = require("../../config/constant");



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

var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single("file");



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
    // if (data.serial) {
    //   lookupCondition.push({ "serial": data.serial },)
    // }
    // if (data.contractId) {
    //   lookupCondition.push({ "unique_key": data.contractId })
    // }
    // if (data.venderOrder) {
    //   lookupCondition.push({ "order.venderOrder": data.venderOrder })
    // }
    // if (data.orderId) {
    //   lookupCondition.push({ "order.unique_key": data.orderId },)
    // }

    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let query = [
      {
        $match:
        {
          $and: [
            { serial: { $regex: `^${data.serial ? data.serial : ''}` } },
            { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
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
          pipeline: [
            // {
            //   $lookup: {
            //     from: "dealers",
            //     localField: "dealerId",
            //     foreignField: "_id",
            //     as: "dealer",
            //   }
            // },
            // {
            //   $lookup: {
            //     from: "resellers",
            //     localField: "resellerId",
            //     foreignField: "_id",
            //     as: "reseller",
            //   }
            // },
            {
              $lookup: {
                from: "customers",
                localField: "customerId",
                foreignField: "_id",
                as: "customers",
              }
            },
            { $unwind: "$customers" },
            // {
            //   $lookup: {
            //     from: "servicers",
            //     localField: "servicerId",
            //     foreignField: "_id",
            //     as: "servicer",
            //   }
            // },
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
            { "order.venderOrder": { $regex: `^${data.venderOrder ? data.venderOrder : ''}` } },
            { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "order.customers.username": { $regex: `^${data.customerName ? data.customerName : ''}` } },
          ]
        },
      },
      { $skip: skipLimit },
      { $limit: pageLimit },
    ]

    let limitData = Number(pageLimit)
    let getContracts = await contractService.getAllContracts2(query)

    res.send({
      code: constant.successCode,
      result: getContracts
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
      let file = req.file;
      let filename = file.filename;
      let originalName = file.originalname;
      let size = file.size;
      res.send({
        code: constant.successCode,
        message: 'Success!',
        result: {
          fileName: filename,
          name: originalName,
          size: size,
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

   let claimResponse = await claimService.createClaim(data)


  }
  catch (err) { }
}
