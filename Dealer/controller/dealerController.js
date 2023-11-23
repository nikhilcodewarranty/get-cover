const { Dealer } = require("../model/dealer");
const { DealerPrice } = require("../model/dealerPrice");
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");

exports.getAllDealers = async (req, res, next) => {
  try {
    const dealers = await dealerService.getAllDealers();
    if (!dealers) {
      res.status(404).json("There are no dealers published yet!");
    }
    res.json(dealers);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createDealers = async (req, res, next) => {
  try {
    const createdDealers = await dealerService.createDealers(req.body);
    if (!createdDealers) {
      res.status(404).json("There are no dealer created yet!");
    }
    res.json(createdDealers);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getDealerById = async (req, res, next) => {
  try {
    const singleDealer = await dealerService.getDealerById(dealerId);
    if (!singleDealer) {
      res.status(404).json("There are no dealer found yet!");
    }
    res.json(singleDealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateDealer = async (req, res, next) => {
  try {
    const updateDealer = await dealerService.updateDealer(req.body);
    if (!updateDealer) {
      res.status(404).json("There are no dealer updated yet!");
    }
    res.json(updateDealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteDealer = async (req, res, next) => {
  try {
    const deleteDealer = await dealerService.deleteDealer(req.body.id);
    if (!deleteDealer) {
      res.status(404).json("There are no dealer deleted yet!");
    }
    res.json(deleteDealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
