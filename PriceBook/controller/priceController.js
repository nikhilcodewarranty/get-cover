const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const constant = require("../../config/constant");

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
    let data = req.body
    let checkCat = await priceBookService.getPriceCatById({ _id: data.priceCatId })
    if (!checkCat) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Category"
      })
      return;
    }
    let priceBookData = {
      name:data.name,
      description:data.description,
      term:data.term,
      frontingFee:data.frontingFee,
      reinsuranceFee:data.reinsuranceFee,
      adminFee:data.adminFee,
      category:checkCat._id,
    }
    let savePriceBook = await priceBookService.savePriceBook(priceBookData)
    if(!savePriceBook){
      res.send({
        code:constant.errorCode,
        message:"Unable to save the price book"
      })
    }else{
      res.send({
        code:constant.successCode,
        message:"Success"
      })
    }
  } catch (error) {
    res.send({
      code: code.errorCode,
      message: err.message
    })
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


// price category api's

exports.createPriceCat = async (req, res) => {
  try {
    let data = req.body
    let catData = {
      name: data.name,
      description: data.description
    }
    let createPriceCat = await priceBookService.createPriceCat(catData)
    if (!createPriceCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the price category"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Created Successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get all price category
exports.getPriceCat = async (req, res) => {
  try {
    let projection = { isDeleted: 0, __v: 0 }
    let query = { status: true, isDeleted: false }
    let getCat = await priceBookService.getAllPriceCat(query, projection)
    if (!getCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the price categories"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getCat
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


