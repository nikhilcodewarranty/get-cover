const { claim } = require("../model/claim");
const { claimPart } = require("../model/claimPart");
const { claimStatus } = require("../model/claimStatus");
const claimResourceResponse = require("../utils/constant");
const claimService = require("../services/claimService");
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
  if (req.role != 'Super Admin') {
    res.send({
      code: constant.successCode,
      message: "Only super admin allow to do this action!"
    });
    return;
  }
}
