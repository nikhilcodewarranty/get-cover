require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const XLSX = require("xlsx");
const userResourceResponse = require("../utils/constant");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const userService = require("../services/userService");
const dealerService = require('../../Dealer/services/dealerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");
const fs = require('fs');
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');


//----------------------- api's function ---------------//

// create user 
exports.createUser = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };
    const createdUser = await userService.createUser(req.body);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  };
};

//Create new service provider By SA
exports.createServiceProvider = async (req, res) => {
  try {
    const data = req.body;
    const providerUserArray = data.providers;
    // Find data by email
    const emailValues = providerUserArray.map(value => value.email);

    const userData = await userService.findByEmail(emailValues);

    if (userData) {
      return res.send({
        code: constant.errorCode,
        message: 'Email Already Exists',
        data: userData
      });
    }

    // Hash the password
    //const hashedPassword = await bcrypt.hash(data.password, 10);

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: 'Invalid role',
      });
    }

    // Create a new provider meta data
    const providerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      userAccount: req.body.customerAccountCreated,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy,
    };

    // Create the service provider
    const createMetaData = await providerService.createServiceProvider(providerMeta);
    if (!createMetaData) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create servicer account',
      });
    }

    // Remove duplicates
    const resultProvider = providerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
    const resultProviderData = accountCreationFlag
      ? await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, status: true, password: hashedPassword };
      }))
      : await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, password: hashedPassword };
      }));

    // Map provider data


    // Create provider users
    const createProviderUsers = await userService.insertManyUser(resultProviderData);
    if (!createProviderUsers) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create users',
      });
    }

    return res.send({
      code: constant.successCode,
      message: 'Successfully Created',
    });

  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
      data: createMetaData
    });
  }
};

// add new terms /// only for backend use
exports.createTerms = async (req, res) => {
  try {
    const monthTerms = generateMonthTerms(10); // You can specify the number of months as needed


    const createdTerms = await userService.createTerms(monthTerms);

    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data: createdTerms
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the terms"
    });
  }
};


exports.tryUpload = async (req, res) => {
  try {
    // Check if a file is uploaded
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    if (!req.file) {
      res.send({
        code: constant.errorCode,
        message: "No file uploaded"
      })
      return;
    }
  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};



//generate monthly terms /// only for backend use
const generateMonthTerms = (numberOfTerms) => {
  const monthTerms = [];

  for (let i = 1; i <= numberOfTerms; i++) {
    const months = i * 12;
    const monthObject = {
      terms: `${months}`,
      status: true
    };

    monthTerms.push(monthObject);
  }

  return monthTerms;
};


// validate dealer by super admin

exports.validateData = async (req, res) => {
  const data = req.body;
  // Check if the user has Super Admin role
  if (req.role !== "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only Super Admin is allowed to perform this action"
    });
    return
  }

  // Check if the specified role exists
  const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
  if (!checkRole) {
    res.send({
      code: constant.errorCode,
      message: "Invalid role"
    });
    return;
  }

  let priceBook = [];
  const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
  const dealersUserData = data.dealers ? data.dealers : [];
  const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
  let checkPriceBook = [];

  let dealerPriceArray = data.priceBook ? data.priceBook : [];
  const uniqueEmails = new Set(allEmails);


  if (allEmails.length !== uniqueEmails.size) {
    res.send({
      code: constant.errorCode,
      message: 'Multiple user cannot have same emails',
    });
    return
  }
  // const emailData = await userService.findByEmail(allEmails);
  // if (emailData.length > 0) {
  //   res.send({
  //     code: constant.errorCode,
  //     message: 'Email Already Exist',
  //     data: emailData
  //   });
  //   return;
  // }

  let savePriceBookType = req.body.savePriceBookType

  if (savePriceBookType == 'yes') {
    //check price book  exist or not
    priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
    const priceBookCreateria = { _id: { $in: priceBook } }
    // console.log("priceBookCreateria=======================", priceBookCreateria)
    checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
    if (checkPriceBook.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Product does not exist.Please check the product"
      })
      return;
    }

    const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
    if (missingProductNames.length > 0) {
      res.send({
        code: constant.errorCode,
        message: 'Some products is not created. Please check the product',
        missingProductNames: missingProductNames
      });
      return;
    }

  }
  if (data.dealerId != 'null' && data.dealerId != undefined) {
    const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      });
      return;
    }

    //check new name is not exist in the database

    const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
    const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();


    if (cleanStr1 !== cleanStr2) {
      const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
      if (existingDealer) {
        res.send({
          code: constant.errorCode,
          message: 'Dealer name already exists',
        });
        return
      }
    }

    //check product is already exist for dealer this
    if (priceBook.length > 0) {
      let query = {
        $and: [
          { 'priceBook': { $in: priceBook } },
          { 'dealerId': data.dealerId }
        ]
      }

      const existingData = await dealerPriceService.findByIds(query);
      if (existingData.length > 0) {
        res.send({
          code: constant.errorCode,
          message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
        });
        return;
      }

    }

  }

  else {
    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
      res.send({
        code: constant.errorCode,
        message: 'Dealer name already exists',
      });
      return
    }
  }
  res.send({
    code: constant.successCode,
    message: 'Success',
  });
}


function uniqByKeepLast(data, key) {

  return [

    ...new Map(

      data.map(x => [key(x), x])

    ).values()

  ]

}

// create dealer by super admin
exports.createDealer = async (req, res) => {
  try {
    uploadMiddleware.singleFileUpload(req, res, async () => {

      const data = req.body;
      // Check if the specified role exists
      const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
      if (!checkRole) {
        res.send({
          code: constant.errorCode,
          message: "Invalid role"
        });
        return;
      }

      let priceBook = [];
      let priceBookIds = [];
      let csvStatus = [];
      const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
      const dealersUserData = data.dealers ? data.dealers : [];
      const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
      let checkPriceBook = [];
      let dealerPriceArray = data.priceBook ? data.priceBook : [];
      const uniqueEmails = new Set(allEmails);
      if (allEmails.length !== uniqueEmails.size) {
        res.send({
          code: constant.errorCode,
          message: 'Multiple user cannot have same email',
        });
        return
      }
      let count = await dealerPriceService.getDealerPriceCount();

      let savePriceBookType = req.body.savePriceBookType
      const allUserData = [...dealersUserData, ...primaryUserData];
      if (data.dealerId != 'null' && data.dealerId != undefined) {
        const singleDealerUser = await userService.findOneUser({ accountId: data.dealerId });
        const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
        if (!singleDealer) {
          res.send({
            code: constant.errorCode,
            message: "Dealer Not found"
          });
          return;
        }
        if (savePriceBookType == 'yes') {
          priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
          const priceBookCreateria = { _id: { $in: priceBook } }
          // console.log("priceBookCreateria=======================", priceBookCreateria)
          checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
          if (checkPriceBook.length == 0) {
            res.send({
              code: constant.errorCode,
              message: "Product does not exist.Please check the product"
            })
            return;
          }

          const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
          if (missingProductNames.length > 0) {
            res.send({
              code: constant.errorCode,
              message: 'Some products is not created. Please check the product',
              missingProductNames: missingProductNames
            });
            return;
          }
          const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
          const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();


          if (cleanStr1 !== cleanStr2) {
            const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
            if (existingDealer) {
              res.send({
                code: constant.errorCode,
                message: 'Dealer name already exists',
              });
              return
            }
          }
          //check product is already exist for dealer this
          priceBookIds = dealerPriceArray.map((dealer) => new mongoose.Types.ObjectId(dealer.priceBookId));
          if (priceBook.length > 0) {
            let query = {
              $and: [
                { 'priceBook': { $in: priceBookIds } },
                { 'dealerId': new mongoose.Types.ObjectId(data.dealerId) }
              ]
            }

            const existingData = await dealerPriceService.findByIds(query);
            if (existingData.length > 0) {
              res.send({
                code: constant.errorCode,
                message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
              });
              return;
            }

          }
          const resultPriceData = dealerPriceArray.map((obj, index) => ({
            'priceBook': obj.priceBookId,
            'dealerId': data.dealerId,
            'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
            'retailPrice': obj.retailPrice,
            "status": obj.status,
            'wholesalePrice': obj.wholesalePrice,
            'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
          }));
          //Primary information edit

          let userQuery = { accountId: { $in: [data.dealerId] }, isPrimary: true }

          let newValues1 = {
            $set: {
              email: allUserData[0].email,
              firstName: allUserData[0].firstName,
              lastName: allUserData[0].lastName,
              phoneNumber: allUserData[0].phoneNumber,
              position: allUserData[0].position,
              status: allUserData[0].status,
            }
          }

          let updateStatus = await userService.updateUser(userQuery, newValues1, { new: true })
          const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
          if (!createPriceBook) {
            res.send({
              code: constant.errorCode,
              message: "Unable to save price book"
            });
            return;
          }
          let allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: checkRole._id,
            accountId: data.dealerId,
            isPrimary: index === 0 ? true : false,
            status: req.body.isAccountCreate ? obj.status : false
          }));
          if (allUsersData.length > 1) {
            allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
            const createUsers = await userService.insertManyUser(allUsersData);
            if (!createUsers) {
              res.send({
                code: constant.errorCode,
                message: "Unable to save users"
              });
              return;
            }
          }
          let dealerQuery = { _id: data.dealerId }
          let newValues = {
            $set: {
              status: "Approved",
            }
          }
          let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
          if (!dealerStatus) {
            res.send({
              code: constant.errorCode,
              message: "Unable to approve dealer status"
            });
            return;
          }

          let statusUpdateCreateria = { accountId: { $in: [data.dealerId] } }
          let updateData = {
            $set: {
              approvedStatus: 'Approved'
            }
          }
          let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

          //  let userStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
          let resetPasswordCode = randtoken.generate(4, '123456789')
          let resetLink = `http://15.207.221.207/newPassword/${singleDealerUser._id}/${resetPasswordCode}`
          const mailing = await sgMail.send(emailConstant.dealerApproval(singleDealerUser.email,{link:resetLink}))
          if (mailing) {
            let updateStatus = await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
            res.send({
              code: constant.successCode,
              message: 'Successfully Created',
            });
          }
        }
        else if (savePriceBookType == 'no') {
          if (!req.file) {
            res.send({
              code: constant.errorCode,
              message: "No file uploaded"
            })
            return;
          }
          let csvName = req.file.filename
          const csvWriter = createCsvWriter({
            path: './uploads/resultFile/' + csvName,
            header: [
              { id: 'priceBook', title: 'Price Book' },
              { id: 'status', title: 'Status' },
              { id: 'reason', title: 'Reason' },
              // Add more headers as needed
            ],
          });

          const results = [];
          let priceBookName = [];
          let allpriceBookIds = [];
          let newArray1;
          let allPriceBooks;
          const wb = XLSX.readFile(req.file.path);
          const sheets = wb.SheetNames;
          const ws = wb.Sheets[sheets[0]];
          const headers = [];

          for (let cell in ws) {
            // Check if the cell is in the first row and has a non-empty value
            if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
              headers.push(ws[cell].v);
            }
          }
          if (sheets.length > 0) {
            let original_csv_array = ['priceBook', 'retailPrice'];

            if (original_csv_array.length != headers.length) {
              res.send({
                code: constant.errorCode,
                message: 'The csv coloumn is not match.Please check the csv format'
              });
              return;
            }

            let equality = Array.isArray(original_csv_array) &&
              Array.isArray(headers) &&
              original_csv_array.length === headers.length &&
              original_csv_array.every((val, index) => val === headers[index]);

            if (!equality) {
              res.send({
                code: constant.errorCode,
                message: 'Invalid Csv! '
              });
              return;
            }


            const data1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
            let results = data1
              .filter(obj => obj.priceBook !== undefined && obj.retailPrice !== undefined)
              .map(obj => ({
                priceBook: obj.priceBook,
                retailPrice: obj.retailPrice,
              }));

            let unique = uniqByKeepLast(results, it => it.priceBook)
            priceBookName = unique.map(obj => obj.priceBook);
            const priceBookName1 = results.map(name => new RegExp(`${name.priceBook}`, 'i'));
            const foundProducts = await priceBookService.findByName(priceBookName1);

            if (foundProducts.length > 0) {
              // Extract the names and ids of found products
              const foundProductData = foundProducts.map(product => ({
                priceBook: product._id,
                name: product.name,
                dealerId: req.body.dealerId,
                status: true,
                wholePrice: Number(product.frontingFee) + Number(product.reserveFutureFee) + Number(product.reinsuranceFee) + Number(product.adminFee)
              }));
              const missingProductNames = priceBookName.filter(name => !foundProductData.some(product => product.name.toLowerCase() === name.toLowerCase()));
              if (missingProductNames.length > 0) {
                missingProductNames.map(product => {
                  let csvData = {
                    'priceBook': product,
                    'status': 'Failed',
                    'reason': 'The product is not exist in the catalog',

                  }
                  csvStatus.push(csvData)
                })
              }
              const allpriceBookIds = foundProductData.map(obj => new mongoose.Types.ObjectId(obj.priceBook));
              // Check for duplicates and return early if found
              if (allpriceBookIds.length > 0) {
                let query = {
                  $and: [
                    { 'priceBook': { $in: allpriceBookIds } },
                    { 'dealerId': new mongoose.Types.ObjectId(req.body.dealerId) }
                  ]
                }
                let existingData = await dealerPriceService.findByIds(query);

                if (existingData.length > 0) {
                  const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
                  const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();
                  if (cleanStr1 !== cleanStr2) {
                    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
                    if (existingDealer) {
                      res.send({
                        code: constant.errorCode,
                        message: 'Dealer name already exists',
                      });
                      return
                    }
                  }

                  allPriceBooks = existingData.map(obj => obj.priceBooks).flat();

                  newArray1 = results
                    .filter(obj => !allPriceBooks.some(existingObj => existingObj.name.toLowerCase().includes(obj.priceBook.toLowerCase())))
                    .map(obj => ({
                      priceBook: obj.priceBook,
                      status: true,
                      retailPrice: obj.retailPrice,
                      dealerId: req.body.dealerId,
                    }));


                  // Merge brokerFee from newArray into foundProductData based on priceBook
                  const mergedArray = foundProductData.map((foundProduct, index) => {
                    const matchingItem = newArray1.find(item => item.priceBook.toLowerCase() === foundProduct.name.toLowerCase());

                    if (matchingItem != undefined) {
                      return {
                        ...foundProduct,
                        retailPrice: matchingItem.retailPrice,
                        brokerFee: ((matchingItem.retailPrice) - foundProduct.wholePrice).toFixed(2),
                        unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
                        wholesalePrice: foundProduct.wholePrice
                      };
                    }
                  });

                  const mergedArrayWithoutUndefined = mergedArray.filter(item => item !== undefined);
                  const uploaded = await dealerPriceService.uploadPriceBook(mergedArrayWithoutUndefined);
                  if (uploaded) {
                    existingData.forEach(product => {
                      const priceBooksList = product.priceBooks.map(priceBook => `${priceBook.name}`).join('');
                      let csvAlreadyData = {
                        'priceBook': priceBooksList,
                        'status': 'Failed',
                        'reason': 'This product is already in the dealer product catalog',
                      };
                      csvStatus.push(csvAlreadyData);
                    });
                    // res.send({
                    //   code: constant.successCode,
                    //   message: 'Success',
                    //   data: uploaded
                    // });

                  }
                }

                else {
                  newArray1 = results
                    .filter(obj => foundProductData.some(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase()))
                    .map((obj, index) => {
                      const matchingProduct = foundProductData.find(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase());
                      const updatedCount = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1;
                      //Print the value of updatedCount
                      return {
                        priceBook: matchingProduct.priceBook,
                        status: true,
                        dealerId: req.body.dealerId,
                        unique_key: updatedCount,
                        retailPrice: obj.retailPrice,
                        brokerFee: (Number(obj.retailPrice) - Number(matchingProduct.wholePrice)).toFixed(2),
                        wholesalePrice: matchingProduct ? matchingProduct.wholePrice : 0.00, // Use wholePrice from matching product or null if not found
                      };
                    });

                  upload = await dealerPriceService.uploadPriceBook(newArray1);

                }
              }
            }

            else {
              if (results.length > 0) {
                results.map(product => {
                  let csvData = {
                    'priceBook': product.priceBook,
                    'status': 'Failed',
                    'reason': 'The product is not exist in the catalog',
                  }
                  csvStatus.push(csvData)
                })
              }

            }

            let userQuery = { accountId: { $in: [req.body.dealerId] }, isPrimary: true }

            let newValues1 = {
              $set: {
                email: allUserData[0].email,
                firstName: allUserData[0].firstName,
                lastName: allUserData[0].lastName,
                phoneNumber: allUserData[0].phoneNumber,
                position: allUserData[0].position,
                status: allUserData[0].status,
              }
            }
            let updateStatus = await userService.updateUser(userQuery, newValues1, { new: true })
            let allUsersData = allUserData.map((obj, index) => ({
              ...obj,
              roleId: checkRole._id,
              accountId: req.body.dealerId,
              isPrimary: index === 0 ? true : false,
              status: req.body.isAccountCreate ? obj.status : false
            }));
            if (allUsersData.length > 1) {
              allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
              const createUsers = await userService.insertManyUser(allUsersData);
              if (!createUsers) {
                res.send({
                  code: constant.errorCode,
                  message: "Unable to save users"
                });
                return;
              }
            }
            let dealerQuery = { _id: req.body.dealerId }
            let newValues = {
              $set: {
                status: "Approved",
              }
            }
            let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
            if (!dealerStatus) {
              res.send({
                code: constant.errorCode,
                message: "Unable to approve dealer status"
              });
              return;
            }


            let statusUpdateCreateria = { accountId: { $in: [req.body.dealerId] } }
            let updateData = {
              $set: {
                approvedStatus: 'Approved'
              }
            }
            let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })


            //  let userStatus = await dealerService.upda teDealer(dealerQuery, newValues, { new: true })
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let resetLink = `http://15.207.221.207/newPassword/${singleDealerUser._id}/${resetPasswordCode}`
            const mailing = await sgMail.send(emailConstant.dealerApproval(singleDealerUser.email,{link:resetLink}))

            if (mailing) {
              let updateStatus = await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              const res12 = await csvWriter.writeRecords(csvStatus);


              // Construct the base URL link
              const base_url_link = 'http://15.207.221.207:3002/uploads/resultFile';

              // Get the CSV name from the csvWriter path
              const csvName1 = csvName;

              // Construct the complete URL
              const complete_url = `${base_url_link}/${csvName1}`;


              let entriesData = {
                userName: singleDealer.name,
                totalEntries: Number(results.length),
                SuccessEntries: Number(results.length) - Number(csvStatus.length),
                failedEntries: Number(csvStatus.length),
                routeLink: complete_url
              }


              // Send email with the CSV file link
              const mailing = await sgMail.send(emailConstant.sendCsvFile('nikhil@codenomad.net', entriesData));

              res.send({
                code: constant.successCode,
                message: 'Successfully Created',
              });

            }

            else {
              res.send({
                code: constant.errorCode,
                message: 'Failed ! Please check email.',
              });

              return;
            }
          }
        }

        return;
      }
      else {
        const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
        if (existingDealer) {
          res.send({
            code: constant.errorCode,
            message: 'Dealer name already exists',
          });
          return
        }
        if (savePriceBookType == 'yes') {
          priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
          const priceBookCreateria = { _id: { $in: priceBook } }
          checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
          if (checkPriceBook.length == 0) {
            res.send({
              code: constant.errorCode,
              message: "Product does not exist.Please check the product"
            })
            return;
          }

          const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
          if (missingProductNames.length > 0) {
            res.send({
              code: constant.errorCode,
              message: 'Some products is not created. Please check the product',
              missingProductNames: missingProductNames
            });
            return;
          }


          let count = await dealerService.getDealerCount();
          const dealerMeta = {
            name: data.name,
            street: data.street,
            userAccount: req.body.customerAccountCreated,
            city: data.city,
            zip: data.zip,
            state: data.state,
            country: data.country,
            status: 'Approved',
            createdBy: data.createdBy,
            unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
          };
          // Create Dealer Meta Data
          const createMetaData = await dealerService.createDealer(dealerMeta);
          if (!createMetaData) {
            res.send({
              code: constant.errorCode,
              message: "Unable to create dealer"
            });
            return;
          }
          // Create User for primary dealer
          const allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: checkRole._id,
            accountId: createMetaData._id,
            position: obj.position ? obj.position : '',
            isPrimary: index === 0 ? true : false,
            status: req.body.isAccountCreate ? obj.status : false,
            approvedStatus: 'Approved'
          }));
          const createUsers = await userService.insertManyUser(allUsersData);

          if (!createUsers) {
            res.send({
              code: constant.errorCode,
              message: "Unable to save users"
            });
            return;
          }
          //save Price Books for this dealer
          count = await dealerPriceService.getDealerPriceCount();
          const resultPriceData = dealerPriceArray.map((obj, index) => ({
            'priceBook': obj.priceBookId,
            'dealerId': createMetaData._id,
            'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
            'retailPrice': obj.retailPrice,
            'wholesalePrice': obj.wholesalePrice,
            "status": obj.status,
            'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
          }));

          const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
          if (!createPriceBook) {
            res.send({
              code: constant.errorCode,
              message: "Unable to save price book"
            });
            return;
          }
          //Approve status 

          let resetPasswordCode = randtoken.generate(4, '123456789')
          let resetLink = `http://15.207.221.207/newPassword/${createUsers[0]._id}/${resetPasswordCode}`
          const mailing = await sgMail.send(emailConstant.dealerApproval(createUsers[0].email,{link:resetLink}))

          if (mailing) {
            let updateStatus = await userService.updateUser({ _id: createUsers[0]._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
            res.send({
              code: constant.successCode,
              message: 'Successfully Created',
              data: createMetaData
            });
          }
        }

        else if (savePriceBookType == 'no') {

          if (!req.file) {
            res.send({
              code: constant.errorCode,
              message: "No file uploaded"
            })
            return;
          }

          let csvName = req.file.filename
          const csvWriter = createCsvWriter({
            path: './uploads/resultFile/' + csvName,
            header: [
              { id: 'priceBook', title: 'Price Book' },
              { id: 'status', title: 'Status' },
              { id: 'reason', title: 'Reason' },
              // Add more headers as needed
            ],
          });

          const count = await dealerService.getDealerCount();
          const results = [];
          let priceBookName = [];
          let allpriceBookIds = [];
          let newArray1;
          let allPriceBooks;
          const wb = XLSX.readFile(req.file.path);
          const sheets = wb.SheetNames;
          const ws = wb.Sheets[sheets[0]];
          const headers = [];
          for (let cell in ws) {
            // Check if the cell is in the first row and has a non-empty value
            if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
              headers.push(ws[cell].v);
            }
          }
       
          if (sheets.length > 0) {
            let original_csv_array = ['priceBook', 'retailPrice'];

            if (original_csv_array.length != headers.length) {
              res.send({
                code: constant.errorCode,
                message: 'The csv coloumn is not match.Please check the csv format'
              });
              return;
            }
            let equality = Array.isArray(original_csv_array) &&
              Array.isArray(headers) &&
              original_csv_array.length === headers.length &&
              original_csv_array.every((val, index) => val === headers[index]);

            if (!equality) {
              res.send({
                code: constant.errorCode,
                message: 'Invalid Csv! '
              });
              return;
            }

            const data1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
            let results = data1
              .filter(obj => obj.priceBook !== undefined && obj.retailPrice !== undefined)
              .map(obj => ({
                priceBook: obj.priceBook,
                retailPrice: obj.retailPrice,
              }));

            let unique = uniqByKeepLast(results, it => it.priceBook)
            priceBookName = unique.map(obj => obj.priceBook);
            const priceBookName1 = results.map(name => new RegExp(`${name.priceBook}`, 'i'));
            const foundProducts = await priceBookService.findByName(priceBookName1);
            const dealerMeta = {
              name: data.name,
              street: data.street,
              userAccount: req.body.customerAccountCreated,
              city: data.city,
              zip: data.zip,
              state: data.state,
              country: data.country,
              status: 'Approved',
              createdBy: data.createdBy,
              unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
            };
            // Create Dealer Meta Data
            const createMetaData = await dealerService.createDealer(dealerMeta);
            if (!createMetaData) {
              res.send({
                code: constant.errorCode,
                message: "Unable to create dealer"
              });
              return;
            }
            if (foundProducts.length > 0) {
              let count1 = await dealerPriceService.getDealerPriceCount();

              // Extract the names and ids of found products
              const foundProductData = foundProducts.map(product => ({
                priceBook: product._id,
                name: product.name,
                dealerId: createMetaData._id,
                status: true,
                wholePrice: Number(product.frontingFee) + Number(product.reserveFutureFee) + Number(product.reinsuranceFee) + Number(product.adminFee)
              }));
              const missingProductNames = priceBookName.filter(name => !foundProductData.some(product => product.name.toLowerCase() === name.toLowerCase()));
              if (missingProductNames.length > 0) {
                missingProductNames.map(product => {
                  let csvData = {
                    'priceBook': product,
                    'status': 'Failed',
                    'reason': 'The product does not exist in the catalog',

                  }
                  csvStatus.push(csvData)
                })

              }
              // Extract _id values from priceBookIds
              const allpriceBookIds = foundProductData.map(obj => new mongoose.Types.ObjectId(obj.priceBook));
              // Check for duplicates and return early if found
              if (allpriceBookIds.length > 0) {
                let query = {
                  $and: [
                    { 'priceBook': { $in: allpriceBookIds } },
                    { 'dealerId': new mongoose.Types.ObjectId(createMetaData._id) }
                  ]
                }
                let existingData = await dealerPriceService.findByIds(query);
                if (existingData.length > 0) {
                  //const mailing = await sgMail.send(emailConstant.sendAlreadyProduct('amit@codenomad.net', existingData, "Already Upload Products"))
                  if (mailing) {
                    // console.log("Mail has been sent");
                  }
                  allPriceBooks = existingData.map(obj => obj.priceBooks).flat();

                  newArray1 = results
                    .filter(obj => !allPriceBooks.some(existingObj => existingObj.name.toLowerCase().includes(obj.priceBook.toLowerCase())))
                    .map(obj => ({
                      priceBook: obj.priceBook,
                      status: true,
                      retailPrice: obj.retailPrice,
                      dealerId: createMetaData._id,
                    }));

                  const mergedArray = foundProductData.map((foundProduct, index) => {
                    const matchingItem = newArray1.find(item => item.priceBook.toLowerCase() === foundProduct.name.toLowerCase());

                    if (matchingItem != undefined) {
                      return {
                        ...foundProduct,
                        retailPrice: matchingItem.retailPrice,
                        brokerFee: ((matchingItem.retailPrice) - foundProduct.wholePrice).toFixed(2),
                        unique_key: Number(count1.length > 0 && count1[0].unique_key ? count1[0].unique_key : 0) + 1,
                        wholesalePrice: foundProduct.wholePrice
                      };
                    }

                  });
                  const mergedArrayWithoutUndefined = mergedArray.filter(item => item !== undefined);
                  const uploaded = await dealerPriceService.uploadPriceBook(mergedArrayWithoutUndefined);
                  existingData.forEach(product => {
                    const priceBooksList = product.priceBooks.map(priceBook => `${priceBook.name}`).join('');
                    let csvAlreadyData = {
                      'priceBook': priceBooksList,
                      'status': 'Failed',
                      'reason': 'The product is already in the catalog',
                    };
                    csvStatus.push(csvAlreadyData);
                  });

                }

                else {
                  newArray1 = results
                    .filter(obj => foundProductData.some(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase()))
                    .map((obj, index) => {
                      const matchingProduct = foundProductData.find(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase());
                      const updatedCount = Number(count1.length > 0 && count1[0].unique_key ? count1[0].unique_key : 0) + index + 1;
                      //Print the value of updatedCount
                      return {
                        priceBook: matchingProduct.priceBook,
                        status: true,
                        dealerId: createMetaData._id,
                        unique_key: updatedCount,
                        retailPrice: obj.retailPrice,
                        brokerFee: (Number(obj.retailPrice) - Number(matchingProduct.wholePrice)).toFixed(2),
                        wholesalePrice: matchingProduct ? matchingProduct.wholePrice : null, // Use wholePrice from matching product or null if not found
                      };
                    });
                  const uploaded = await dealerPriceService.uploadPriceBook(newArray1);
                }

              }

            }
            else {
              if (results.length > 0) {
                results.map(product => {
                  let csvData = {
                    'priceBook': product.priceBook,
                    'status': 'Failed',
                    'reason': 'The product is not exist in the catalog',
                  }
                  csvStatus.push(csvData)
                })
              }

            }
            let allUsersData = allUserData.map((obj, index) => ({
              ...obj,
              roleId: checkRole._id,
              accountId: createMetaData._id,
              isPrimary: index === 0 ? true : false,
              status: req.body.isAccountCreate ? obj.status : false
            }));
            const createUsers = await userService.insertManyUser(allUsersData);
            if (!createUsers) {
              res.send({
                code: constant.errorCode,
                message: "Unable to save users"
              });
              return;
            }
            let dealerQuery = { _id: createMetaData._id }
            let newValues = {
              $set: {
                status: "Approved",
              }
            }
            let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
            if (!dealerStatus) {
              res.send({
                code: constant.errorCode,
                message: "Unable to approve dealer status"
              });
              return;
            }

            let statusUpdateCreateria = { accountId: { $in: [createMetaData._id] } }
            let updateData = {
              $set: {
                approvedStatus: 'Approved'
              }
            }
            let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

            //  let userStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
            let resetPasswordCode = randtoken.generate(4, '123456789')
            let resetLink = `http://15.207.221.207/newPassword/${createUsers[0]._id}/${resetPasswordCode}`
            const mailing = await sgMail.send(emailConstant.dealerApproval(createUsers[0].email,{link:resetLink}))
            if (mailing) {
              let updateStatus = await userService.updateUser({ _id: createUsers[0]._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              const res12 = await csvWriter.writeRecords(csvStatus);


              // Construct the base URL link
              const base_url_link = 'http://15.207.221.207:3002/uploads/resultFile';

              // Get the CSV name from the csvWriter path
              const csvName1 = csvName;

              // Construct the complete URL
              const complete_url = `${base_url_link}/${csvName1}`;


              let entriesData = {
                userName: data.name,
                totalEntries: Number(results.length),
                SuccessEntries: Number(results.length) - Number(csvStatus.length),
                failedEntries: Number(csvStatus.length),
                routeLink: complete_url
              }

              // Send email with the CSV file link
              const mailing = await sgMail.send(emailConstant.sendCsvFile('nikhil@codenomad.net', entriesData));

              res.send({
                code: constant.successCode,
                message: 'Successfully Created',
                data: createMetaData
              });
            }
            else {
              res.send({
                code: constant.errorCode,
                message: 'Failed ! Please check email.',
              });

              return;
            }
          }
        }


      }

    })
  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};
//save Dealer Meta Data
//---------------------------------------------------- refined code ----------------------------------------//

// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email });
    if (!user) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    if (user.status == false) {
      res.send({
        code: constant.errorCode,
        message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
      })
      return;
    }
    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    let roleQuery = { _id: user.roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: getRole.role },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "356d" }
    );

    res.send({
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// create super admin credentials
exports.createSuperAdmin = async (req, res) => {
  try {
    let data = req.body
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email already exist"
      })
      return;
    }

    // Check if the provided role is 'super'
    const superRole = await role.findOne({ role: "Super Admin" });
    if (!superRole) {
      res.send({
        code: constant.errorCode,
        message: "Role not found"
      })
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    let userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: data.accountId,
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, //Assign super role
      isPrimary: data.isPrimary,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = await userService.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //success response 
    res.send({
      code: constant.successCode,
      message: "Account created successfully",
      data: savedUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    });
  }
};

// get all users 
exports.getAllUsers = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };
    const checkRole = await role.findOne({ role: { '$regex': req.params.role, '$options': 'i' } });
    let query = { roleId: new mongoose.Types.ObjectId(checkRole ? checkRole._id : '000000000000000000000000'), isDeleted: false }
    console.log(query)
    let projection = { isDeleted: 0, __v: 0 }
    const users = await userService.getAllUsers(query, projection);
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        users: users
      }
    })
  } catch (error) {
    res
      .status(constant.errorCode)
      .json({ error: "Internal server error" });
  }
};

//get user detail with ID
exports.getUserById = async (req, res) => {
  try {
    let projection = { __v: 0, status: 0 }
    let userId = req.params.userId ? req.params.userId : '000000000000000000000000'
    const singleUser = await userService.getUserById(userId, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// update user details with ID
exports.updateUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
    let option = { new: true };
    const updateUser = await userService.updateUser(criteria, req.body, option);
    if (!updateUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

exports.updateUserData = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.userId };
    let option = { new: true };
    const updateUser = await userService.updateSingleUser(criteria, data, option);
    if (!updateUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result:updateUser
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// get all roles
exports.getAllTerms = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const terms = await userService.getAllTerms(query, projection);
    if (!terms) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the terms "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        terms: terms
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// add new roles
exports.addRole = async (req, res) => {
  try {
    let checkRole = await userService.getRoleById({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } })
    if (checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Role already exist"
      })
      return;
    }
    const createdUser = await userService.addRole(req.body);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the role"
      })
    }
    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data: createdUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

//send reset password link to email
exports.sendLinkToEmail = async (req, res) => {
  try {
    let data = req.body
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (!checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User does not exist"
      })
    } else {
      if (checkEmail.status == false || checkEmail.isDeleted == true) {
        res.send({
          code: constant.errorCode,
          message: "This account is currently awaiting approval from the administrator"
        })
        return;
      }
      const mailing = await sgMail.send(emailConstant.resetpassword(checkEmail._id, resetPasswordCode, checkEmail.email))

      if (mailing) {
        let updateStatus = await userService.updateUser({ _id: checkEmail._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
        res.send({
          code: constant.successCode,
          message: "Email has been sent",
          codes: resetPasswordCode
        })
      }
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//reset password with link
exports.resetPassword = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId })
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Invalid link"
      })
      return;
    };
    if (checkUser.resetPasswordCode != req.params.code) {
      res.send({
        code: constant.errorCode,
        message: "Link has been expired"
      })
      return;
    };
    let hash = await bcrypt.hashSync(data.password, 10);
    let newValues = {
      $set: {
        password: hash,
        resetPasswordCode: null,
        isResetPassword: false
      }
    }
    let option = { new: true }
    let criteria = { _id: checkUser._id }
    let updatePassword = await userService.updateUser(criteria, newValues, option)
    if (updatePassword) {
      res.send({
        code: constant.successCode,
        message: "Password updated successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//delete user api
exports.deleteUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true }
    const deleteUser = await userService.deleteUser(criteria, newValue, option);
    if (!deleteUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};


exports.uploadPriceBook = async (req, res) => {
  try {
    // Check if a file is uploaded
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    if (!req.file) {
      res.send({
        code: constant.errorCode,
        message: "No file uploaded"
      })
      return;
    }
    //check Dealer Exist
  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};


// get all roles
exports.getAllRoles = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const roles = await userService.getAllRoles(query, projection);
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the roles "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        roles: roles
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    let Query = { isDeleted: false, title: 'New Dealer Registration' }
    let Query1 = { isDeleted: false, title: 'New Servicer Registration' }
    let projection = { __v: 0 }
    const dealerNotification = await userService.getAllNotifications(Query, projection);
    const servicerNotification = await userService.getAllNotifications(Query1, projection);
    const dealerIds = dealerNotification.map(value => value.userId);
    const servicerIds = servicerNotification.map(value => value.userId);
    // const query1 = { accountId: { $in: accountIds }, isPrimary: true };
    const query1 = { _id: { $in: dealerIds } };
    const query2 = { _id: { $in: servicerIds } };

    let dealerData = [];
    let allNotification = [];

    allNotification = [...dealerNotification, ...servicerNotification];

    let dealerMeta = await dealerService.getAllDealers(query1, projection)
    let servicerMeta = await providerService.getAllServiceProvider(query2, projection)
    dealerData = [...dealerMeta, ...servicerMeta];

    // console.log("dealerData============================",dealerData)
    // console.log("allNotification============================",allNotification);

    //  return false;

    //console.log(dealerData);return false;

    const result_Array = dealerData.map(item1 => {
      const matchingItem = allNotification.find(item2 => item2.userId.toString() == item1._id.toString());
      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          notificationData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    const sortedResultArray = result_Array.sort((a, b) => {
      const createdAtA = new Date(a.notificationData.createdAt);
      const createdAtB = new Date(b.notificationData.createdAt);

      return createdAtB - createdAtA;
    });

    // console.log(sortedResultArray);



    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        notification: sortedResultArray
      }
    });

    return;
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};
exports.checkEmail = async (req, res) => {
  try {
    // Check if the email already exists
    const existingUser = await userService.findOneUser({ 'email': req.body.email });
    // console.log(existingUser)
    if (existingUser && existingUser.approvedStatus == 'Approved') {
      res.send({
        code: constant.errorCode,
        message: "Email is already exist!",

      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      status: 'Pending'
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

exports.notificationStatusUpdate = async (req, res) => {
  try {
    let flag = req.params.flag;
    let cretria = flag == 'dealer' ? 'New Dealer Registration' : 'New Servicer Registration';
    if (cretria != '') {
      criteria = { status: false, flag: flag };
    }
    else {
      criteria = { status: false };
    }
    let newValue = {
      $set: {
        status: true
      }
    };
    //Update Notification
    const updateNotification = await userService.updateNotification(criteria, newValue, { new: true });
    if (!updateNotification) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the notifications "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
    });

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};
exports.getCountNotification = async (req, res) => {
  try {
    const allNotification = await userService.getCountNotification();

    res.send({
      code: constant.successCode,
      message: "Successful",
      count: allNotification
    });

    return;
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};






