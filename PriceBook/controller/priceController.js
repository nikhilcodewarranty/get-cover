const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const constant = require("../../config/constant");


//------------- price book api's------------------//

//get all price books
exports.getAllPriceBooks = async (req, res, next) => {
  try {
    let query = { status: true, isDeleted: false }
    let projection = { isDeleted: 0, __v: 0 }
    const priceBooks = await priceBookService.getAllPriceBook(query, projection);
    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//create new price book
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
    // price book data 
    let priceBookData = {
      name: data.name,
      description: data.description,
      term: data.term,
      frontingFee: data.frontingFee,
      reinsuranceFee: data.reinsuranceFee,
      adminFee: data.adminFee,
      reserveFutureFee: data.reserveFutureFee,
      category: checkCat._id,
    }
    let savePriceBook = await priceBookService.createPriceBook(priceBookData)
    if (!savePriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to save the price book"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get price book by id 
exports.getPriceBookById = async (req, res, next) => {
  try {
    let query = { _id: req.params.priceId }
    let projection = { isDeleted: 0, __v: 0 }
    const singlePriceBook = await priceBookService.getPriceBookById(
      query, projection
    );
    if (!singlePriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price detail"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singlePriceBook
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//update price book
exports.updatePriceBook = async (req, res, next) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.priceId }
    if (data.priceCatId) {
      let checkCat = await priceBookService.getPriceCatById({ _id: data.priceCatId })
      if (!checkCat) {
        res.send({
          code: constant.errorCode,
          message: "Invalid category ID"
        })
        return;
      }
      //data to
      let newValue = {
        $set: {
          name: data.name,
          description: data.description,
          term: data.term,
          frontingFee: data.frontingFee,
          reserveFutureFee: data.reserveFutureFee,
          reinsuranceFee: data.reinsuranceFee,
          adminFee: data.adminFee,
          category: data.category,
          status:data.status
        }
      };
      let option = { new: true }

      let updateCat = await priceBookService.updatePriceBook(criteria, newValue, option)
      if (!updateCat) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the price"
        })
      } else {
        res.send({
          code: constant.successCode,
          message: "Successfully updated"
        })
      }
    }

    //data to
    let newValue = {
      $set: {
        name: data.name,
        description: data.description,
        term: data.term,
        frontingFee: data.frontingFee,
        reserveFutureFee: data.reserveFutureFee,
        reinsuranceFee: data.reinsuranceFee,
        adminFee: data.adminFee,
        category: data.category,
      }
    };
    let option = { new: true }

    let updateCat = await priceBookService.updatePriceBook(criteria, newValue, option)
    if (!updateCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated"
      })
    }

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//delete price 
exports.deletePriceBook = async (req, res, next) => {
  try {
    let criteria = {_id:req.params.priceId};
    let newValue = {
      $set:{
        isDeleted:true
      }
    };
    let option = {new:true};
    const deletedPriceBook = await priceBookService.deletePriceBook(criteria,newValue,option);
    if (!deletedPriceBook) {
      res.send({
        code:constant.errorCode,
        message:"Unable to delete the price book"
      })
    return;
    }
    res.send({
      code:constant.successCode,
      message:"Deleted Successfully"
    })
  } catch (err) {
    res.send({
      code:constant.errorCode,
      message:err.message
    })
  }
};



//----------------- price categories api's --------------------------//


// create price category api's
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

//update price category 
exports.updatePriceCat = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.catId }
    let checkCat = await priceBookService.getPriceCatById(criteria)
    if (!checkCat) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category ID"
      })
      return;
    };

    let newValue = {
      $set: {
        name: data.name ? data.name : checkCat.name,
        description: data.description ? data.description : checkCat.description,
        status:data.status
      }
    };
    let option = { new: true }

    let updateCat = await priceBookService.updatePriceCategory(criteria, newValue, option)
    if (!updateCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated"
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get price category by ID
exports.getPriceCatById = async (req, res) => {
  try {
    let ID = req.params.catId
    let projection = { isDeleted: 0, __v: 0 }
    let getPriceCat = await priceBookService.getPriceCatById(ID, projection)
    if (!getPriceCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price category"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getPriceCat
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

