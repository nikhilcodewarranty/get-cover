const { Dealer } = require("../model/dealer");
const { DealerPrice } = require("../model/dealerPrice");
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const constant = require('../../config/constant')

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
    //fetching data from user table
    let data = req.body
    let getUser = await USER.findOne({_id:req.userId})
    if(!getUser){
      res.send({
        code:constant.errorCode,
        message:"Invalid token ID"
      })
      return;
    }

    const singleDealer = await dealerService.getDealerById({_id:getUser.accountId});
    let result = getUser.toObject()
    result.metaData = singleDealer
    if (!singleDealer) {
     res.send({
      code:constant.errorCode,
      message:"No data found"
     })
    }else{
      res.send({
        code:constant.successCode,
        message:"Success",
        result:result
       })
    }
    
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

// exports.statusUpdate = async (req, res) => {
//   try {
//     let data = req.body
//     let criteria = {_id:req.params.dealerId};
//     let checkDealer = await dealerService.getDealerById(req.params.dealerId)
//     if(checkDealer.)
//     let newValue = {
//       $set:{

//       }
//     }
//     const approoveAccount = await dealerService.statusUpdate(criteria,newValue,option);
//     if (!approoveAccount) {
//       res.send({
//         code:constant.errorCode,
//         message:"Unable to approve the account"
//       })
//       return;
//     }
//     res.json(approoveAccount);
//   } catch (error) {
//     res
//       .status(dealerResourceResponse.serverError.statusCode)
//       .json({ error: "Internal server error" });
//   }
// };


