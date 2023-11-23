const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");

exports.getAllPriceBooks = async (req, res, next) => {
  try {
    const priceBooks = await priceBookService.getAllPriceBooks();
    if (!priceBooks) {
      res.status(404).json("There are no price book published yet!");
    }
    res.json(priceBooks);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createPriceBook = async (req, res, next) => {
  try {
    const createdPriceBook = await priceBookService.createPriceBook(req.body);
    if (!createdPriceBook) {
      res.status(404).json("There are no price book created yet!");
    }
    res.json(createdPriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getPriceBookById = async (req, res, next) => {
  try {
    const singlePriceBook = await priceBookService.getPriceBookById(
      priceBookId
    );
    if (!singlePriceBook) {
      res.status(404).json("There are no price book found yet!");
    }
    res.json(singlePriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updatePriceBook = async (req, res, next) => {
  try {
    const updatedPriceBook = await priceBookService.updatePriceBook(req.body);
    if (!updatedPriceBook) {
      res.status(404).json("There are no price book updated yet!");
    }
    res.json(updatedPriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deletePriceBook = async (req, res, next) => {
  try {
    const deletedPriceBook = await priceBookService.deletePriceBook(
      req.body.id
    );
    if (!deletedPriceBook) {
      res.status(404).json("There are no price book deleted yet!");
    }
    res.json(deletedPriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
