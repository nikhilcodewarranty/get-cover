const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const dealerService = require("../../Dealer/services/dealerService");
const orderService = require("../../Order/services/orderService");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
const constant = require("../../config/constant");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose');
const logs = require("../../User/model/logs");

//------------- price book api's------------------//

//get all price books
exports.getAllPriceBooks = async (req, res, next) => {
  try {
    let data = req.body
    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : ''
    let filterStatus = (data.status === true || data.status === false) ? (data.status === true ? true : false) : ""
    data.status = typeof (filterStatus) == "string" ? "all" : filterStatus
    let query;
    if (data.status != "all") {
      query = {
        $and: [
          { isDeleted: false },
          { 'name': { '$regex': searchName, '$options': 'i' } },
          { 'status': data.status },
          { 'category': { $in: catIdsArray } }
        ]
      };
    } else {
      query = {
        $and: [
          { isDeleted: false },
          { 'name': { '$regex': searchName, '$options': 'i' } },
          { 'category': { $in: catIdsArray } }
        ]
      };
    }
    // return;
    if (data.term != '') {
      query.$and.push({ 'term': Number(data.term) });
    }
    if (data.priceType != '') {
      query.$and.push({ 'priceType': data.priceType });
      if (data.priceType == 'Flat Pricing') {
        query.$and.push({ 'rangeStart': { $lte: Number(data.range) } });
        query.$and.push({ 'rangeEnd': { $gte: Number(data.range) } });
        // const flatQuery = {
        //   $and: [
        //     { 'rangeStart': { $lte: Number(data.range) } },
        //     { 'rangeEnd': { $gte: Number(data.range) } },
        //   ]
        // }
        // query.$and.push(flatQuery);
      }
    }

    // console.log("filter-------------------------", query);


    // return
    console.log("-----------------------------------------", query)
    let projection = { isDeleted: 0, __v: 0 }
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1
    const priceBooks = await priceBookService.getAllPriceBook(query, projection, limit, page);
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

//Get all actvie price book
exports.getAllActivePriceBook = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let getPriceBooks = await priceBookService.getAllActivePriceBook({ status: true, isDeleted: false }, { __v: 0 })
    if (!getPriceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find the price books"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getPriceBooks
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

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
    let quantityPriceDetail;
    if (data.priceType == 'Quantity Pricing') {
      quantityPriceDetail = data.quantityPriceDetail;
    }
    const count = await priceBookService.getPriceBookCount();
    data.name = data.name.trim().replace(/\s+/g, ' ');

    // price book data 
    let priceBookData = {
      name: data.name,
      description: data.description,
      term: data.term,
      frontingFee: data.frontingFee,
      reinsuranceFee: data.reinsuranceFee,
      adminFee: data.adminFee,
      priceType: data.priceType,
      rangeStart: data.rangeStart,
      rangeEnd: data.rangeEnd,
      reserveFutureFee: data.reserveFutureFee,
      quantityPriceDetail: quantityPriceDetail,
      category: checkCat._id,
      coverageType: data.coverageType,
      status: data.status,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    }

    // console.log(priceBookData);
    // return;

    let checkPriceBook = await priceBookService.getPriceBookById({ name: { '$regex': new RegExp(`^${data.name}$`, 'i') } }, {})

    if (checkPriceBook.length > 0) {
      res.send({
        code: constant.errorCode,
        message: "Product already exist with this name"
      })
      return;
    }
    //console.log("checkPriceBook=====================",checkPriceBook);return;
    let savePriceBook = await priceBookService.createPriceBook(priceBookData)
    if (!savePriceBook) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBook",
        body: req.body,
        response: {
          code: constant.errorCode,
          message: "Unable to save the price book",
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to save the price book",

      })
    } else {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBook",
        body: req.body,
        response: {
          code: constant.successCode,
          message: "Success",
          data: savePriceBook
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.successCode,
        message: "Success",
        data: savePriceBook
      })
    }
  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBook catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get price book by id 
exports.getPriceBookById = async (req, res, next) => {
  try {
    let query = { _id: new mongoose.Types.ObjectId(req.params.priceBookId) }
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
      result: singlePriceBook[0]
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
    if (req.role !== 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

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
      res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return;
    }
    // Check if the request body is empty
    if (Object.keys(body).length === 0) {
      res.send({
        code: constant.errorCode,
        message: "Content cannot be empty"
      });
      return;
    }

    // Check if the priceId is a valid ObjectId
    const isValidPriceId = await checkObjectId(params.priceBookId);
    if (!isValidPriceId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book Id format"
      });
      return;
    }

    // Check if the category is a valid ObjectId
    const isValidCategory = await checkObjectId(body.priceCatId);
    if (!isValidCategory) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Category Id format"
      });
      return
    }

    //check Category exist with this ID

    const isValid = await priceBookService.getPriceCatById({ _id: body.priceCatId }, {});
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Category is not exist with this ID"
      });
      return;
    }


    const criteria = { _id: new mongoose.Types.ObjectId(params.priceBookId) };
    let projection = { isDeleted: 0, __v: 0 }
    const existingPriceBook = await priceBookService.getPriceBookById(criteria, projection);
    if (!existingPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Price Book is not exist with this id"
      });
      return;
    }
    // let quantityPriceDetail = [
    //   {

    //     name: '',
    //     quantity: ''

    //   }];
    // if (body.priceType == 'Quantity Pricing') {
    //   quantityPriceDetail = body.quantityPriceDetail;
    // }
    const newValue = {
      $set: {
        status: body.status,
        frontingFee: body.frontingFee || existingPriceBook.frontingFee,
        reserveFutureFee: body.reserveFutureFee || existingPriceBook.reserveFutureFee,
        reinsuranceFee: body.reinsuranceFee || existingPriceBook.reinsuranceFee,
        adminFee: body.adminFee || existingPriceBook.adminFee,
        category: body.priceCatId || existingPriceBook.category,
        description: body.description || existingPriceBook.description,
        priceType: body.priceType || existingPriceBook.priceType,
        rangeStart: body.rangeStart ? body.rangeStart : existingPriceBook.rangeStart,
        rangeEnd: body.rangeEnd ? body.rangeEnd : existingPriceBook.rangeStart,
        quantityPriceDetail: body.quantityPriceDetail || existingPriceBook.quantityPriceDetail
      }
    };
    // Update Price Book Status
    //const updateResult = await updatePriceBookStatus(params.priceId, body);

    const updateResult = await priceBookService.updatePriceBook({ _id: params.priceBookId }, newValue, { new: true })
    if (!updateResult) {
      // Update Dealer Price Book Status
      // const updateDealerResult = await updateDealerPriceStatus(params.priceId, body.status);
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price book",
      });
      return;
    }

    else {
      //change dealer status if body status is false
      if (body.status == false) {
        const newValue = { status: body.status };
        const option = { new: true };
        console.log(body.status)
        let updateOrder = await orderService.updateManyOrder({ 'productsArray.priceBookId': params.priceBookId, status: 'Pending' }, { status: 'Archieved' }, option)
        console.log("updateOrder================", updateOrder);
        const updatedPriceBook = await dealerPriceService.updateDealerPrice({ priceBook: params.priceBookId }, newValue, { new: true });
      }
    }

    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePriceBook",
      body: req.body,
      response: {
        code: constant.successCode,
        message: "Successfully Update",
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Successfully Update",
    });
    return;

  } catch (error) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePriceBook catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: error.message
      }
    }
    await logs(logData).save()
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
      status: newData.status,
      frontingFee: newData.frontingFee || existingPriceBook.frontingFee,
      reserveFutureFee: newData.reserveFutureFee || existingPriceBook.reserveFutureFee,
      reinsuranceFee: newData.reinsuranceFee || existingPriceBook.reinsuranceFee,
      adminFee: newData.adminFee || existingPriceBook.adminFee,
      category: newData.category || existingPriceBook.category,
      description: newData.description || existingPriceBook.description,
    }
  };
  const statusCreateria = { _id: { $in: [priceId] } }
  const option = { new: true };
  const updatedCat = await priceBookService.updatePriceBook(statusCreateria, newValue, option);
  console.log(updatedCat);
  return {
    success: !!updatedCat,
    message: updatedCat ? "Successfully updated" : "Unable to update the data",
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
        { 'name': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'description': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'state': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'city': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'zip': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
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
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    const data = req.body;
    data.name = data.name.trim().replace(/\s+/g, ' ');
    // Check if the category already exists
    const existingCategory = await priceBookService.getPriceCatByName({ name: { '$regex': new RegExp(`^${data.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingCategory) {
      res.send({
        code: constant.errorCode,
        message: "Category already exist"
      })
      return;
    }
    // Check Total Counts
    const count = await priceBookService.getTotalCount();
    // console.log(count);return false;
    const catData = {
      name: data.name,
      description: data.description,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    };
    // Create the price category
    const createdCategory = await priceBookService.createPriceCat(catData);
    if (!createdCategory) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBookCat",
        body: catData,
        response: {
          code: constant.errorCode,
          message: 'Unable to create the price category'
        }
      }
      await logs(logData).save()

      res.send({
        code: constant.errorCode,
        message: 'Unable to create the price category'
      });
      return;
    }
    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBookCat",
      body: catData,
      response: {
        code: constant.successCode,
        message: 'Created Successfully',
        data: createdCategory
      }
    }
    await logs(logData).save()
    // Return success response
    res.send({
      code: constant.successCode,
      message: 'Created Successfully',
      data: createdCategory
    });

  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBookCat  catchError",
      body: catData,
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await logs(logData).save()
    // Handle unexpected errors
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// get all price category
exports.getPriceBookCat = async (req, res) => {
  try {
    let data = req.body

    let projection = { isDeleted: 0, __v: 0 }
    let query;
    console.log(data.status)
    if (data.status) {
      query = {
        $and: [
          { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          { 'status': data.status },
          { isDeleted: false }
        ]
      }
    } else {
      query = {
        $and: [
          { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          { isDeleted: false }
        ]
      }
    }
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

exports.getActivePriceBookCategories = async (req, res) => {
  try {
    let data = req.body
    let ID = req.query.priceBookId == "undefined" ? "61c8c7d38e67bb7c7f7eeeee" : req.query.priceBookId

    let getDealer = await dealerService.getDealerByName({ _id: data.dealerId }, { __v: 0 })
    if (!getDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }

    let query1 = { _id: new mongoose.Types.ObjectId(ID) }
    let getPriceBook = await priceBookService.getPriceBookById(query1, {})

    let query;
    if (getPriceBook[0]) {
      query = {
        $and: [
          { status: true },
          { _id: getPriceBook ? getPriceBook[0].category._id : "" },
          { coverageType: data.coverageType ? data.coverageType : getDealer.coverageType }
        ]
      }
    } else {
      query = {
        $and: [
          { status: true },
          { coverageType: data.coverageType ? data.coverageType : getDealer.coverageType }
        ]
      }
    }
    let projection = { __v: 0 }
    let getCategories = await priceBookService.getAllActivePriceCat(query, projection)

    if (!getCategories) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the categories"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getCategories
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

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
    let data = req.body
    if (!isSuperAdmin(req.role)) {
      res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return;
    }
    // Check if the priceId is a valid ObjectId
    const isValidCatId = await checkObjectId(req.params.catId);
    if (!isValidCatId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book Category Id format"
      });
      return;
    }
    const isValid = await priceBookService.getPriceCatById({ _id: req.params.catId }, {});
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Category is not exist with this ID"
      });
      return;
    }

    if (data.name == undefined && data.description == undefined) {
      res.send({
        code: constant.errorCode,
        message: "No data provided"
      })
      return
    }
    // Check if the category already exists
    if (isValid.name.toLowerCase() != req.body.name.toLowerCase()) {
      const existingCategory = await priceBookService.getPriceCatByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
      if (existingCategory) {
        res.send({
          code: constant.errorCode,
          message: "Category already exist"
        })
        return;
      }
    }

    const newValue = {
      $set: {
        name: data.name ? data.name : isValid.name,
        description: data.description ? data.description : isValid.description,
        status: data.status
      }
    };

    const updateCatResult = await priceBookService.updatePriceCategory({ _id: req.params.catId }, newValue, { new: true });
    if (!updateCatResult) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/updatePricebookCat",
        body: newValue,
        response: {
          code: constant.errorCode,
          message: "Unable to update the price book category"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price book category"
      })
    }
    else {
      //Update PriceBook if status is false
      if (data.status == false) {
        let updatePriceBook = await priceBookService.updatePriceBook({ category: updateCatResult._id }, { status: data.status }, { new: true })
        let projection = { isDeleted: 0, __v: 0 }
        let updateOrder = await orderService.updateManyOrder({ 'productsArray.categoryId': req.params.catId, status: 'Pending' }, { status: 'Archieved' }, { new: true })

        const allPriceBookIds = await priceBookService.getAllPriceIds({ category: req.params.catId }, projection);
        const priceIdsToUpdate = allPriceBookIds.map((price) => price._id);
        if (priceIdsToUpdate) {
          dealerCreateria = { priceBook: { $in: priceIdsToUpdate } }
          const updatedPriceBook1 = await dealerPriceService.updateDealerPrice(dealerCreateria, { status: data.status }, { new: true });
        }

      }
    }
    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePricebookCat",
      body: req.body,
      response: {
        code: constant.successCode,
        message: "Successfully updated",
        result: updateCatResult
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Successfully updated",
      result: updateCatResult
    })
  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePricebookCat  catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// get price category by ID
exports.getPriceBookCatById = async (req, res) => {
  try {
    let ID = { _id: req.params.catId }
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
    let query = { 'name': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } };
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

exports.getPriceBookByCategoryId = async (req, res) => {
  try {
    let data = req.body

    let catQuery = { _id: req.params.categoryId }
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
    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1
    let queryFilter = {
      $and: [
        { category: new mongoose.Types.ObjectId(req.params.categoryId) },
        { status: true }
      ]
    };
    //console.log("queryFilter=======================",queryFilter)
    let fetchPriceBooks = await priceBookService.getAllPriceBook(queryFilter, { __v: 0 }, limit, page)
    // console.log("fetchPriceBooks=======================",fetchPriceBooks)
    // return;
    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: {
        priceBooks: fetchPriceBooks ? fetchPriceBooks : []
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//
exports.getCategoryByPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkPriceBook = await priceBookService.getPriceBookById({ name: req.params.name }, {})
    console.log('checkPriceBook==================', checkPriceBook);
    if (!checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "No such Price Book found."
      })
      return;
    }
    let getCategoryDetail = await priceBookService.getPriceCatByName({ _id: checkPriceBook.category }, {})
    console.log('getCategoryDetail=======================', getCategoryDetail)
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


