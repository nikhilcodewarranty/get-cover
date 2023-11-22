const { Claims } = require("../model/claims");
const { ClaimsPart } = require("../model/claimsPart");
const { ClaimsStatus } = require("../model/claimsStatus");
const ClaimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimsService");

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

exports.createClaims = async (req, res, next) => {
  try {
    const createdClaims = await claimService.createClaims(req.body);
    if (!createdClaims) {
      res.status(404).json("There are no claim created yet!");
    }
    res.json(createdClaims);
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
    const updateClaim = await claimService.updateClaim(req.body);
    if (!updateClaim) {
      res.status(404).json("There are no claim updated yet!");
    }
    res.json(updateClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
exports.deleteClaim = async (req, res, next) => {
  try {
    const deleteClaim = await claimService.deleteClaim(req.body.id);
    if (!deleteClaim) {
      res.status(404).json("There are no claim deleted yet!");
    }
    res.json(deleteClaim);
  } catch (error) {
    res
      .status(claimResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
