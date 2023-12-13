const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const constant = require("../../config/constant");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose');

//------------- price book api's------------------//

//get all price books
exports.getAllPriceBooks = async (req, res, next) => {
  try {
    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
      ]
    };

    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let query = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': searchName, '$options': 'i' } },
        { 'category': { $in: catIdsArray } }
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

    let checkPriceBook = await priceBookService.getPriceBookById({ name: data.name }, {})
    if (checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Product already exist with this name"
      })
      return;
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
    let query = { _id: req.params.priceBookId }
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

    // Check if the user is a Super Admin
    if (!isSuperAdmin(role)) {
      return res.status(403).json({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
    }

    // Check if the request body is empty
    if (Object.keys(body).length === 0) {
      return res.status(400).json({
        code: constant.errorCode,
        message: "Content cannot be empty"
      });
    }

    // Check if the priceId is a valid ObjectId
    const isValidPriceId = await checkObjectId(params.priceId);
    if (!isValidPriceId) {
      return res.status(400).json({
        code: constant.errorCode,
        message: "Invalid Price Book Id format"
      });
    }

    // Check if the category is a valid ObjectId
    const isValidCategory = await checkObjectId(body.category);
    if (!isValidCategory) {
      return res.status(400).json({
        code: constant.errorCode,
        message: "Invalid Category Id format"
      });
    }

    // Update Price Book Status
    const updateResult = await updatePriceBookStatus(params.priceId, body);

    if (updateResult.success) {
      // Update Dealer Price Book Status
      const updateDealerResult = await updateDealerPriceStatus(params.priceId, body.status);

      return res.status(updateDealerResult.success ? 200 : 500).json({
        code: updateDealerResult.success ? constant.successCode : constant.errorCode,
        message: updateDealerResult.message,
      });
    }

    return res.status(500).json({
      code: constant.errorCode,
      message: updateResult.message,
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
  const existingPriceBook = await priceBookService.getPriceBookById(criteria, projection);

  if (!existingPriceBook) {
    return {
      success: false,
      message: "Invalid Price Book ID"
    };
  }

  const newValue = {
    $set: {
      status: newData.status || existingPriceBook.status,
      frontingFee: newData.frontingFee || existingPriceBook.frontingFee,
      reserveFutureFee: newData.reserveFutureFee || existingPriceBook.reserveFutureFee,
      reinsuranceFee: newData.reinsuranceFee || existingPriceBook.reinsuranceFee,
      adminFee: newData.adminFee || existingPriceBook.adminFee,
      category: newData.category || existingPriceBook.category,
      description: newData.description || existingPriceBook.status,
    }
  };
  const statusCreateria = { _id: { $in: [priceId] } }
  const option = { new: true };
  const updatedCat = await priceBookService.updatePriceBook(statusCreateria, newValue, option);
  return {
    success: !!updatedCat,
    message: updatedCat ? "Successfully updated" : "Unable to update the data",
  };
};

// Function to update Dealer Price Book based on category status
const updateDealerPriceStatus = async (priceId, categoryStatus) => {
  if (!categoryStatus) {
    const criteria = { priceBook: { $in: [priceId] } }
    const newValue = { status: categoryStatus };
    const option = { new: true };
    const updatedPriceBook = await dealerPriceService.updateDealerPrice(criteria, newValue, option);
    return {
      success: !!updatedPriceBook,
      message: updatedPriceBook ? "Successfully updated" : "Unable to update the data"
    };
  }
  return {
    message: "Successfully updated"
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
    // Ensure the user has the required role
    if (req.role !== 'Super Admin') {
      return res.status(403).json({
        code: constant.errorCode,
        message: 'Only super admin is allowed to perform this action'
      });
    }
    const data = req.body;
    // Check if the category already exists
    const existingCategory = await priceBookService.getPriceCatByName({ name: data.name }, { isDeleted: 0, __v: 0 });
    if (existingCategory) {
      return res.status(400).json({
        code: constant.errorCode,
        message: 'Category name already exists'
      });
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false }
    // Check Total Counts
    const count = await priceBookService.getTotalCount();
    const catData = {
      name: data.name,
      description: data.description,
      unique_key: parseInt(count) + 1
    };
    // Create the price category
    const createdCategory = await priceBookService.createPriceCat(catData);
    if (!createdCategory) {
      return res.status(500).json({
        code: constant.errorCode,
        message: 'Unable to create the price category'
      });
    }

    // Return success response
    res.status(201).json({
      code: constant.successCode,
      message: 'Created Successfully',
      data: createdCategory
    });

  } catch (err) {
    // Handle unexpected errors
    res.status(500).json({
      code: constant.errorCode,
      message: err.message
    });
  }
};

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
  if (!categoryStatus) {
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
  }

  return {
    message: "Successfully updated"
  };

};

const checkObjectId = async (Id) => {
  // Check if the potentialObjectId is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(Id)) {
    return true;
  } else {
    return false;
  }
}
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


    // Check if the categoryId is a valid ObjectId
    const isValid = await checkObjectId(req.params.catId);
    if (!isValid) {
      return res.status(400).json({
        code: constant.errorCode,
        message: "Invalid category format"
      });
    }
    if (body.name == undefined && body.description == undefined) {
      res.send({
        code: constant.errorCode,
        message: "No data provided"
      })
      return
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
    let ID = { _id: req.params.name }
    let projection = { isDeleted: 0, __v: 0 }
    console.log(ID);
    console.log(projection);
    let getPriceCat = await priceBookService.getPriceCatById(ID, projection);
    console.log('getPriceCat.........', getPriceCat);
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

// Get price book by category name
exports.getPriceBookByCategory = async (req, res) => {
  try {
    let data = req.body

    let catQuery = { name: req.params.categoryName }
    let catProjection = { __v: 0 }
    // check the request is having category id or not
    let checkCategory = await priceBookService.getPriceCatByName(catQuery, catProjection)
    if (!checkCategory) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category"
      })
      return;
    }
    let fetchPriceBooks = await priceBookService.getAllPriceBook({ category: checkCategory._id }, { __v: 0 })
    if (!fetchPriceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price books"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: {
        priceBooks: fetchPriceBooks
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getCategoryByPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkPriceBook = await priceBookService.getPriceBookById({ name: req.params.name }, {})
    console.log('checkPriceBook==================',checkPriceBook);
    if (!checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "No such Price Book found."
      })
      return;
    }
    let getCategoryDetail = await priceBookService.getPriceCatByName({ _id: checkPriceBook.category }, {})
    console.log('getCategoryDetail=======================',getCategoryDetail)
    if (!getCategoryDetail) {
      res.send({
        code: constant.errorCode,
        message: "Category not found"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        priceBookCategory: getCategoryDetail,
        priceBookDetails: checkPriceBook
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}
