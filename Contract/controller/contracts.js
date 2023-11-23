const { Contracts } = require("../model/contract");
const contractResourceResponse = require("../utils/constant");
const contractService = require("../services/contractService");

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

exports.createContract = async (req, res, next) => {
  try {
    const createdContract = await contractService.createContract(req.body);
    if (!createdContract) {
      res.status(404).json("There are no contract created yet!");
    }
    res.json(createdContract);
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
    const updatedContract = await contractService.updateContract(req.body);
    if (!updatedContract) {
      res.status(404).json("There are no contract updated yet!");
    }
    res.json(updatedContract);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteContract = async (req, res, next) => {
  try {
    const deletedContract = await contractService.deleteContract(req.body.id);
    if (!deletedContract) {
      res.status(404).json("There are no contract deleted yet!");
    }
    res.json(deletedContract);
  } catch (error) {
    res
      .status(contractResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
