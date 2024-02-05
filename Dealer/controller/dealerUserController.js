require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer")
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const connection = require('../../db')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');
const { id } = require('../validators/register_dealer');
const { isBoolean } = require('util');
const { string } = require('joi');
const providerService = require('../../Provider/services/providerService');
const { getServicer } = require('../../Provider/controller/serviceAdminController');
const resellerService = require('../services/resellerService');


var StorageP = multer.diskStorage({
    destination: function (req, files, cb) {
        cb(null, path.join(__dirname, '../../uploads/resultFile'));
    },
    filename: function (req, files, cb) {
        cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
    }
})

var uploadP = multer({
    storage: StorageP,
}).single('file');

//users api

exports.getDealerUsers = async (req, res) => {
    try {
        let data = req.body
        //fetching data from user table

        const dealers = await dealerService.getSingleDealerById({ _id: req.userId }, { accountStatus: 1 });

        //result.metaData = singleDealer
        if (!dealers) {
            res.send({
                code: constant.errorCode,
                message: "Dealer not found"
            });
            return;
        };
        const users = await dealerService.getUserByDealerId({ accountId: req.userId, isDeleted: false });

        let name = data.firstName ? data.firstName : ""
        let nameArray = name.trim().split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };

        const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
        const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')


        const filteredData = users.filter(entry => {
            return (
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });


        //result.metaData = singleDealer
        if (!users) {
            res.send({
                code: constant.errorCode,
                message: "No data found"
            });
            return
        }
        console.log(dealers)
        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData,
            dealerStatus: dealers[0].accountStatus
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//price api

exports.getPriceBooks = async (req, res) => {
    try {
        let checkDealer = await dealerService.getSingleDealerById({ _id: req.userId }, { isDeleted: false })

        if (checkDealer.length == 0) {
            res.send({
                code: constant.errorCode,
                message: "Dealer Not found"
            })
            return;
        }
        let projection = { isDeleted: 0, __v: 0 }
        let query = { isDeleted: false, status: true, dealerId: new mongoose.Types.ObjectId(req.userId) }
        let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
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

exports.getAllPriceBooksByFilter = async (req, res, next) => {
    try {
        let data = req.body
        data.status = typeof (data.status) == "string" ? "all" : data.status
        console.log(data)
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
        let query
        console.log("lklklkkklk", data.status)
        // let query ={'dealerId': new mongoose.Types.ObjectId(data.dealerId) };

        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'status': true },
                {
                    dealerId: new mongoose.Types.ObjectId(req.userId)
                }
            ]
        };



        //
        let projection = { isDeleted: 0, __v: 0 }

        let limit = req.body.limit ? req.body.limit : 10000
        let page = req.body.page ? req.body.page : 1
        const priceBooks = await dealerPriceService.getAllPriceBooksByFilter(query, projection, limit, page);
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

//servicers api

exports.getDealerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.userId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }
        let ids = getServicersIds.map((item) => item.servicerId)
        console.log('%%%%%%%%%%%%%%%%%%%%%',ids)
        let servicer = await providerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }

        const servicerIds = servicer.map(obj => obj._id);
        const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

        let servicerUser = await userService.getMembers(query1, {})
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        const result_Array = servicer.map(item1 => {
            const matchingItem = servicerUser.find(item2 => item2.accountId.toString() === item1._id.toString());

            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: item1.toObject()
                };
            } else {
                return servicerUser.toObject();
            }
        });

        const nameRegex = new RegExp(data.name ? data.name.trim() : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email.trim() : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone.trim() : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.servicerData.name) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            data: filteredData
        });

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicersList = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false, accountStatus: "Approved", status: true, dealerId: null, resellerId: null }
        let projection = { __v: 0, isDeleted: 0 }
        let servicer = await providerService.getAllServiceProvider(query, projection);


        let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.userId })

        const resultArray = servicer.map(item => {
            const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
            const documentData = item._doc;
            return { ...documentData, check: !!matchingServicer };
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: resultArray
        });
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.createDeleteRelation = async(req,res)=>{
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerByName({ _id: req.userId })
        if (!checkDealer) {
          res.send({
            code: constant.errorCode,
            message: "Invalid dealer ID"
          })
          return;
        }
    
        const trueArray = [];
        const falseArray = [];
    
        data.servicers.forEach(item => {
          if (item.status || item.status == "true") {
            trueArray.push(item);
          } else {
            falseArray.push(item);
          }
        });
    
        console.log('asdfadf++++++++++',trueArray,falseArray)
    
        let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
        let checkId = trueArray.map(record => record._id)
        const existingRecords = await dealerRelationService.getDealerRelations({
          dealerId: new mongoose.Types.ObjectId(req.userId),
          servicerId: { $in: checkId }
        });
    
        // Step 2: Separate existing and non-existing servicer IDs
        const existingServicerIds = existingRecords.map(record => record.servicerId.toString());
    
        const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));
    
        console.log(')))))))))))))))))',existingRecords, existingServicerIds, checkId, newServicerIds)
        // Step 3: Delete existing records
        let deleteData = await dealerRelationService.deleteRelations({
          dealerId: new mongoose.Types.ObjectId(req.userId),
          servicerId: { $in: uncheckId }
        });
        console.log('***************************',deleteData)
        // return res.json(deleteData)
        // Step 4: Insert new records
        const newRecords = newServicerIds.map(servicerId => ({
          dealerId: req.userId,
          servicerId: servicerId
        }));
        if (newRecords.length > 0) {
          let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
          res.send({
            code: constant.successCode,
            message: "successw"
          })
        } else {
          res.send({
            code: constant.successCode,
            message: "success"
          })
        }
    
    
    
    
    
    
        // for (let i = 0; i < data.servicers.length; i++) {
        //   let servicer = data.servicers[i]
        //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.userId })
        //   if (!checkRelation) {
        //     console.log('new------------')
    
        //   } else {
        //     console.log('delete------------')
    
        //   }
        // }
      }catch(err){
        res.send({
            code:constant.errorCode,
            message:err.message
        })
    }
}

//customers api

exports.getDealerCustomers = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false, dealerId: req.userId, status: true }
        let projection = { __v: 0, firstName: 0, lastName: 0, email: 0, password: 0 }
        const customers = await customerService.getAllCustomers(query, projection);
        if (!customers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the customer"
            });
            return;
        };
        const customersId = customers.map(obj => obj._id.toString());
        const queryUser = { accountId: { $in: customersId }, isPrimary: true };


        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = customers.find(item2 => item2._id.toString() === item1.accountId.toString());

            if (matchingItem) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    customerData: matchingItem.toObject()
                };
            } else {
                return dealerData.toObject();
            }
        });
        let name = data.firstName ? data.firstName : ""
        let nameArray = name.split(" ");

        // Create new keys for first name and last name
        let newObj = {
            f_name: nameArray[0],  // First name
            l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
        };
        console.log('name check ++++++++++++++++++++++=', newObj)
        const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name : '', 'i')
        const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name : '', 'i')
        const emailRegex = new RegExp(data.email ? data.email : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                firstNameRegex.test(entry.firstName) &&
                lastNameRegex.test(entry.lastName) &&
                emailRegex.test(entry.email) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });

        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

//dealers api

exports.getDealerResellers = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerById(req.userId, {})
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        };

        let query = { isDeleted: false, dealerId: req.userId, status: true }
        let projection = { __v: 0 }
        const resellers = await resellerService.getResellers(query, projection);
        if (!resellers) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the resellers"
            });
            return;
        };

        console.log('sjdhfjdshf-------------', resellers)

        const resellerId = resellers.map(obj => obj._id.toString());
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
        console.log('sjdhfjdshf-------------', getPrimaryUser, resellerId, queryUser)

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());

            if (matchingItem) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject()
                };
            } else {
                return dealerData.toObject();
            }
        });

        const emailRegex = new RegExp(data.email ? data.email : '', 'i')
        const nameRegex = new RegExp(data.name ? data.name : '', 'i')
        const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
        const dealerRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')

        const filteredData = result_Array.filter(entry => {
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.resellerData.dealerId) &&
                phoneRegex.test(entry.phoneNumber)
            );
        });
        res.send({
            code: constant.successCode,
            message: "Success",
            result: filteredData
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}




























