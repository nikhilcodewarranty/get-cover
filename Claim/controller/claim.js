const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");



const constant = require("../../config/constant");

exports.getAllClaims = async (req, res, next) => {
  try {
    const claims = await claimService.getAllClaims();
    if (!claims) {
      res.status(404).json("There are no claim published yet!");
    }
    res.json(claims);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createClaim = async (req, res, next) => {
  try {
    const createdClaim = await claimService.createClaim(req.body);
    if (!createdClaim) {
      res.status(404).json("There are no claim created yet!");
    }
    res.json(createdClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getClaimbyId = async (req, res, next) => {
  try {
    const singleClaim = await claimService.getClaimbyId(claimId);
    if (!singleClaim) {
      res.status(404).json("There are no claim found yet!");
    }
    res.json(singleClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateClaim = async (req, res, next) => {
  try {
    const updatedClaim = await claimService.updateClaim(req.body);
    if (!updatedClaim) {
      res.status(404).json("There are no claim updated yet!");
    }
    res.json(updatedClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
exports.deleteClaim = async (req, res, next) => {
  try {
    const deletedClaim = await claimService.deleteClaim(req.body.id);
    if (!deletedClaim) {
      res.status(404).json("There are no claim deleted yet!");
    }
    res.json(deletedClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.searchClaim = async (req, res, next) => {
  let data = req.body
  if (req.role != "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only super admin allow to do this action",
    });
    return;
  }

  let query = [
    // {
    //   $match: { _id: new mongoose.Types.ObjectId(req.params.orderId) }
    // },
    {
      $lookup: {
        from: "contracts",
        localField: "_id",
        foreignField: "orderId",
        as: "contracts"
      }
    },
    {
      $unwind: "$contracts"
    },
    {
      $lookup: {
        from: "dealers",
        localField: "dealerId",
        foreignField: "_id",
        as: "dealers",

      }
    },
    {
      $lookup: {
        from: "serviceproviders",
        localField: "servicerId",
        foreignField: "_id",
        as: "servicer"
      }
    },
    {
      $lookup: {
        from: "resellers",
        localField: "resellerId",
        foreignField: "_id",
        as: "resellers"
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
      $unwind: "$customers"
    },
    {
      $match:
      {
        $and: [
          // { "customers.username": data.customerName },
          { "contracts.serial": data.serial },
          // { "venderOrder": data.venderOrder },
          // { "unique_key": data.orderId },
          // { "contracts.unique_key": data.contractId },
        ],

      }
    },

  ];

  let pageLimit = data.pageLimit ? Number(data.pageLimit) : 10
  let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
  let limitData = Number(pageLimit)
  let ordersResult = await orderService.getOrderWithContract(query, skipLimit, limitData);

  res.send({
    code: constant.successCode,
    result: ordersResult
  })

}
