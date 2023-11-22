const { Contracts } = require("../model/contracts");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractsService");

exports.getAllContracts = async (req, res, next) => {
  try {
    const contracts = await contractService.getAllContracts();
    if (!contracts) {
      res.status(404).json("There are no contract published yet!");
    }
    res.json(contracts);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createContracts = async (req, res, next) => {
  try {
    const createdContracts = await contractService.createContracts(req.body);
    if (!createdContracts) {
      res.status(404).json("There are no contract created yet!");
    }
    res.json(createdContracts);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getContractById = async (req, res, next) => {
  try {
    const singleContract = await contractService.getContractById(contractId);
    if (!singleContract) {
      res.status(404).json("There are no contract found yet!");
    }
    res.json(singleContract);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateContract = async (req, res, next) => {
  try {
    const updateContract = await contractService.updateContract(req.body);
    if (!updateContract) {
      res.status(404).json("There are no contract updated yet!");
    }
    res.json(updateContract);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteContract = async (req, res, next) => {
  try {
    const deleteContract = await contractService.deleteContract(req.body.id);
    if (!deleteContract) {
      res.status(404).json("There are no contract deleted yet!");
    }
    res.json(deleteContract);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
