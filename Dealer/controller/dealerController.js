const { Dealer } = require("../model/dealer");
const { DealerPrice } = require("../model/dealerPrice");
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");

exports.getAllDealers = async (req, res, next) => {
  try {
    const dealers = await dealerService.getAllDealers();
    if (!dealers) {
      res.status(404).json("There are no dealer published yet!");
    }
    res.json(dealers);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createDealer = async (req, res, next) => {
  try {
    const createdDealer = await dealerService.createDealer(req.body);
    if (!createdDealer) {
      res.status(404).json("There are no dealer created yet!");
    }
    res.json(createdDealer);
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
    const updatedDealer = await dealerService.updateDealer(req.body);
    if (!updatedDealer) {
      res.status(404).json("There are no dealer updated yet!");
    }
    res.json(updatedDealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteDealer = async (req, res, next) => {
  try {
    const deletedDealer = await dealerService.deleteDealer(req.body.id);
    if (!deletedDealer) {
      res.status(404).json("There are no dealer deleted yet!");
    }
    res.json(deletedDealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
