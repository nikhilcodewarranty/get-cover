const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
const mongoose = require('mongoose');
const fs = require('fs');

// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');

const checkObjectId = async (Id) => {
  // Check if the potentialObjectId is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(Id)) {
    return true;
  } else {
    return false;
  }
}
// get all dealers 
exports.getAllDealers = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false }
    let projection = { __v: 0, isDeleted: 0 }
    const dealers = await dealerService.getAllDealers(query, projection);
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: dealers
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//create new dealer
exports.createDealer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let data = req.body
    let dealerData = {}
    const createdDealer = await dealerService.createDealer(dealerData);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create a new Dealer"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get dealer detail by ID
exports.getDealerById = async (req, res) => {
  try {
    //fetching data from user table
    let data = req.body
    let getUser = await USER.findOne({ _id: req.userId })
    if (!getUser) {
      res.send({
        code: constant.errorCode,
        message: "Invalid token ID"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: getUser.accountId });
    let result = getUser.toObject()
    result.metaData = singleDealer
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: result
      })
    };
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//update dealer detail with ID
exports.updateDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        // body data will be pass here
      }
    };
    let option = { new: true };
    const updatedDealer = await dealerService.updateDealer(criteria, newValue, option);
    if (!updatedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// delete dealer with dealer ID
exports.deleteDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true };
    const deletedDealer = await dealerService.deleteDealer(criteria, newValue, option);
    if (!deletedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the dealer"
      })
      return;
    };
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

/**---------------------------------------------------Register Dealer-------------------------------------------- */
exports.registerDealer = async (req, res) => {
  try {
    const data = req.body;

    // Check if the specified role exists
    // { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
    const checkRole = await role.findOne({ 'role': { '$regex': data.role, '$options': 'i' } });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      })
      return;
    }

    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: data.name }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer already exist with this name"
      })
      return;
    }
    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Dealer already exist with this email"
      })
      return;
    }

    // Extract necessary data for dealer creation
    const dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
    };

    // Register the dealer
    const createdDealer = await dealerService.registerDealer(dealerMeta);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unbale to create the dealer"
      })
      return;
    }

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      accountId: createdDealer._id,
    };

    // Create the user
    const createdUser = await userService.createUser(userMetaData);
    if (createdUser) {
       res.send({
        code: constant.successCode,
        message: 'Success',
        data: createdUser,
      });
      return
    }
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return;
  }
};

exports.statusUpdate = async (req, res) => {
  try {
    // Check if the user has the required role
    if (req.role !== "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin is allowed to perform this action"
      });
      return
    }

    // Check if the dealerPriceBookId is a valid ObjectId
    const isValid = await checkObjectId(req.params.dealerPriceBookId);
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Dealer Price Book ID"
      });
      return;
    }

    // Fetch existing dealer price book data
    const criteria = { _id: req.params.dealerPriceBookId };
    const projection = { isDeleted: 0, __v: 0 };
    const existingDealerPriceBook = await dealerPriceService.getDealerPriceById(criteria, projection);

    if (!existingDealerPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Price Book ID not found"
      });
      return;
    }

    // Check if the priceBook is a valid ObjectId
    const isPriceBookValid = await checkObjectId(req.body.priceBook);
    if (!isPriceBookValid) {
        res.send({
        code: constant.errorCode,
        message: "Invalid Price Book ID"
      });
      return;
    }

    // Prepare the update data
    const newValue = {
      $set: {
        brokerFee: req.body.brokerFee || existingDealerPriceBook.brokerFee,
        status: req.body.status,
        retailPrice: req.body.retailPrice || existingDealerPriceBook.retailPrice,
        priceBook: req.body.priceBook || existingDealerPriceBook.priceBook,
      }
    };

    const option = { new: true };

    // Update the dealer price status
    const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

    if (!updatedResult) {
       res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer price status"
      });

      return;
      
    }
      res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      data: updatedResult
    });

    return

  } catch (err) {
      res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return
  }
};
// All Dealer Books

exports.getAllDealerPriceBooks = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false }
    let getDealerPrice = await dealerPriceService.getAllDealerPrice(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.uploadPriceBook = async (req, res) => {
  try {
    // Check if a file is uploaded
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const results = [];
    let priceBookName = [];
    let allpriceBookIds = [];
    // Use async/await for cleaner CSV parsing
    require('fs')
      .createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        // Extract priceBook names from results
        const priceBookName = results.map(obj => obj.priceBook);

        const foundProducts = await priceBookService.findByName(priceBookName);

        // Extract the names and ids of found products
        const foundProductData = foundProducts.map(product => ({
          priceBook: product._id,
          name: product.name,
          dealerId: req.body.dealerId,
          status:true
        }));

        const missingProductNames = priceBookName.filter(name => !foundProductData.some(product => product.name === name));
        //  return;
        if (missingProductNames.length > 0) {
          return res.status(400).json({
            code: constant.errorCode,
            message: 'Some product names do not match.',
            missingProductNames: missingProductNames
          });
        }

        if (foundProducts.length == 0) {
          return res.send({
            code: constant.errorCode,
            message: 'Product name is not exist. Please uploads the products and then try again',
          });
        }
        // Extract _id values from priceBookIds
        const allpriceBookIds = foundProductData.map(obj => obj.priceBook);
        // Check for duplicates and return early if found
        if (allpriceBookIds.length > 0) {
          let query = {
            $and: [
              { 'priceBook': { $in: allpriceBookIds } },
              { 'dealerId': req.body.dealerId }
            ]
          }
          const existingData = await dealerPriceService.findByIds(query);
          if (existingData.length > 0) {
             res.send({
              code: constant.errorCode,
              message: 'Uploaded file should be unique for this dealer! Duplicasy found. Please check file and upload again',
            });

          }
        }


        let newArray1 = results.map((obj) => ({
          priceBook: obj.priceBook,
          status: true,
          brokerFee: obj.brokerFee,
          dealerId: req.body.dealerId
        }));

        // Merge brokerFee from newArray into foundProductData based on priceBook
      const mergedArray = foundProductData.map(foundProduct => ({
        ...foundProduct,
        brokerFee: newArray1.find(item => item.priceBook === foundProduct.name)?.brokerFee || foundProduct.brokerFee
      }));

// console.log(mergedArray);return false;
   
            // Map CSV data to a new array with required structure
            // let newArray = results.map((obj) => ({
            //   priceBook: '6579877f1f67a3830048125f',
            //   status: true,
            //   brokerFee: obj.brokerFee,
            //   dealerId: req.body.dealerId
            // }));
       
        // Upload the new data to the dealerPriceService
        const uploaded = await dealerPriceService.uploadPriceBook(mergedArray);

        // Respond with success message and uploaded data
        if (uploaded) {
          return res.send({
            code: constant.successCode,
            message: 'Success',
            data: uploaded
          });
        }
      });
  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

exports.createDealerPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: data.dealerId }, {})
    if (checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer price book already create with this price book"
      })
      return;
    }
    let createDealerPrice = await dealerPriceService.createDealerPrice(data)
    if (!createDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the dealer price book"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: createDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}



