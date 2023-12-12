const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const constant = require("../../config/constant");


//------------- price book api's------------------//

//get all price books
exports.getAllPriceBooks = async (req, res, next) => {
  try {
    // let query = {isDeleted: false }
    let query = {
      $and: [
        { isDeleted: false },
        {
          $or: [
            { 'name': { '$regex': req.body.name, '$options': 'i' } },
            { 'description': { '$regex': req.body.name, '$options': 'i' } },
            { 'state': { '$regex': req.body.name, '$options': 'i' } },
            { 'city': { '$regex': req.body.name, '$options': 'i' } },
            { 'zip': { '$regex': req.body.name, '$options': 'i' } },
          ]
        }
      ]
    };
    let projection = { isDeleted: 0, __v: 0 }
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
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
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
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
      status: data.status
    }
    let savePriceBook = await priceBookService.createPriceBook(priceBookData)
    if (!savePriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to save the price book",

      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        data: savePriceBook
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
        message: "Unable to fetch the price book detail"
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
      let checkCat = await priceBookService.getPrice({ _id: data.priceCatId })
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
          status: data.status
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


//Update by Price Id by me
exports.updatePriceBookById = async (req, res, next) => {
  try {
    const { body, params, role } = req;

    if (!isSuperAdmin(role)) {
      return res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
    }

    const updateresult = await updatePriceBookStatus(params.priceId, body);

    if (updateresult.success) {
      const updateDealerPriceBookResult = await updateDealerPriceStatus(params.priceId, body.status);

      return res.send({
        code: updateDealerPriceBookResult.success ? constant.successCode : constant.errorCode,
        message: updateDealerPriceBookResult.message
      });
    }

    return res.send({
      code: constant.errorCode,
      message: updateresult.message
    });

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

// Function to update price book by me
const updatePriceBookStatus = async (priceId, newData) => {
  const criteria = { _id: priceId };
  let projection = { isDeleted: 0, __v: 0 }
  const existingCat = await priceBookService.getPriceBookById(criteria, projection);

  if (!existingCat) {
    return {
      success: false,
      message: "Invalid Price ID"
    };
  }

  const newValue = {
    $set: {
      description: newData.description,
      term: newData.term,
      category: newData.category,
      status: newData.status
    }
  };
  const statusCreateria = { _id: { $in: [priceId] } }
  const option = { new: true };
  const updatedCat = await priceBookService.updatePriceBook(statusCreateria, newValue, option);

  return {
    success: !!updatedCat,
    message: updatedCat ? "Successfully updated" : "Unable to update the data"
  };
};

// Function to update Dealer Price Book based on category status
const updateDealerPriceStatus = async (priceId, categoryStatus) => {
  const criteria = { priceBook: { $in: [priceId] } }
  const newValue = { status: categoryStatus };
  const option = { new: true };
  const updatedPriceBook = await dealerPriceService.updateDealerPrice(criteria, newValue, option);

  return {
    success: !!updatedPriceBook,
    message: updatedPriceBook ? "Successfully updated" : "Unable to update the data"
  };

};


//delete price 
exports.deletePriceBook = async (req, res, next) => {
  try {
    let criteria = { _id: req.params.priceId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true };
    const deletedPriceBook = await priceBookService.deletePriceBook(criteria, newValue, option);
    if (!deletedPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the price book"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Search price price books
exports.searchPriceBook = async (req, res, next) => {
  try {
    let query = {
      $or: [
        { 'name': { '$regex': req.body.name, '$options': 'i' } },
        { 'description': { '$regex': req.body.name, '$options': 'i' } },
        { 'state': { '$regex': req.body.name, '$options': 'i' } },
        { 'city': { '$regex': req.body.name, '$options': 'i' } },
        { 'zip': { '$regex': req.body.name, '$options': 'i' } },
      ]
    };
    let projection = { isDeleted: 0, __v: 0 };
    const priceBooks = await priceBookService.getAllPriceBook(query, projection);
    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};


//----------------- price categories api's --------------------------//


// create price category api's
exports.createPriceBookCat = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
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
        message: "Created Successfully",
        data: createPriceCat
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
exports.getPriceBookCat = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    // let query = { isDeleted: false }
    let query = {
      $and: [
        { 'name': { '$regex': req.body.name ? req.body.name : '', '$options': 'i' } },
        { isDeleted: false }
      ]
    };

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

// Function to update price book category
const updatePriceBookCategory = async (catId, newData) => {

  //const criteria = { _id: catId };
  let projection = { isDeleted: 0, __v: 0 }
  const existingCat = await priceBookService.getPriceCatById({ _id: catId }, projection);

  if (!existingCat) {
    return {
      success: false,
      message: "Invalid category ID"
    };
  }

  const newValue = {
    $set: {
      name: newData.name || existingCat.name,
      description: newData.description || existingCat.description,
      status: newData.status
    }
  };
  const criteria = { _id: { $in: catId } }
  console.log(criteria);
  const option = { new: true };
  const updatedCat = await priceBookService.updatePriceCategory(criteria, newValue, option);

  return {
    success: !!updatedCat,
    message: updatedCat ? "Successfully updated" : "Unable to update the data"
  };
};

// Function to update Price Book based on category status
const updatePriceBookByCategoryStatus = async (catId, categoryStatus) => {
  //const criteria = { category: catId };
  const criteria = { category: { $in: [catId] } }
  const newValue = { status: categoryStatus };
  const option = { new: true };
  const updatedPriceBook = await priceBookService.updatePriceBook(criteria, newValue, option);
  /**---------------------------Get and update Dealer Price Book Status---------------------------- */
  let projection = { isDeleted: 0, __v: 0 }
  const allPriceBookIds = await priceBookService.getAllPriceIds({ category: catId }, projection);
  const priceIdsToUpdate = allPriceBookIds.map((price) => price._id);
  if (priceIdsToUpdate) {
    dealerCreateria = { priceBook: { $in: priceIdsToUpdate } }
    const updatedPriceBook1 = await dealerPriceService.updateDealerPrice(dealerCreateria, newValue, option);
    return {
      success: !!updatedPriceBook1,
      message: updatedPriceBook1 ? "Successfully updated" : "Unable to update the data"
    };
  }
};

// Function to check if the user is a Super Admin
const isSuperAdmin = (role) => role === "Super Admin";
// Exported function to update price book category
exports.updatePriceBookCat = async (req, res) => {
  try {
    const { body, params, role } = req;
    if (!isSuperAdmin(role)) {
      return res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
    }

    const updateCatResult = await updatePriceBookCategory(params.catId, body);

    if (updateCatResult.success) {
      const updatePriceBookResult = await updatePriceBookByCategoryStatus(params.catId, body.status);

      return res.send({
        code: updatePriceBookResult.success ? constant.successCode : constant.errorCode,
        message: updatePriceBookResult.message
      });
    }

    return res.send({
      code: constant.errorCode,
      message: updateCatResult.message
    });

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// get price category by ID
exports.getPriceBookCatById = async (req, res) => {
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

// search price category with name
exports.searchPriceBookCategories = async (req, res) => {
  try {
    let data = req.body;
    let query = { 'name': { '$regex': req.body.name, '$options': 'i' } };
    let projection = { __v: 0, status: 0 };
    let seachCategory = await priceBookService.getAllPriceCat(query, projection);
    if (!seachCategory) {
      res.send({
        code: constant.errorCode,
        message: "No data found for price categories"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: seachCategory
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}



