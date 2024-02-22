const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
const orderService = require("../../Order/services/orderService");
const contractService = require("../../Contract/services/contractService");




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
              "let": { "id": "$_id" },
              pipeline: [
                // { $match: { $expr: { $eq: ["$_id", "$$id"] } } },
                { $match: { username: data.customerName } }, // Filter by username
                { $project: { _id: 1, username: 1 } }
              ],
              as: "customers"
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
        ]

      }
    },
    {
      $unwind: "$order"
    },
    {
      $match:
      {
        $and: lookupCondition
      },

    },
  ]

  let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
  let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
  let limitData = Number(pageLimit)
  let getContracts = await contractService.getAllContracts(query, skipLimit, pageLimit)

  res.send({
    code: constant.successCode,
    result: getContracts
  })

}
