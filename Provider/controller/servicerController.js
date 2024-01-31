const { serviceProvider } = require("../model/serviceProvider");
const providerService = require("../services/providerService");
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
const role = require("../../User/model/role");
const userService = require("../../User/services/userService");
const constant = require('../../config/constant')
const emailConstant = require('../../config/emailConstant');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const bcrypt = require("bcrypt");
const dealerService = require("../../Dealer/services/dealerService");
const mongoose = require('mongoose')

const randtoken = require('rand-token').generator()


exports.getServicerDetail = async (req, res) => {
    try {
        console.log(req.userId)
        let getMetaData = await userService.findOneUser({ _id: req.userId, isPrimary: true })
        if (!getMetaData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        };
        const singleServiceProvider = await providerService.getServiceProviderById({ _id: getMetaData.accountId });
        if (!singleServiceProvider) {
            res.send({
                code: constant.errorCode,
                message: "Invalid token"
            })
            return;
        };
        let resultUser = getMetaData.toObject()
        resultUser.meta = singleServiceProvider
        res.send({
            code: constant.successCode,
            message: resultUser
        })
    } catch (error) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getServicerUsers = async (req, res) => {
    try {
        let data = req.body
        let getMetaData = await userService.findOneUser({ _id: req.userId, isPrimary: true })
        if (!getMetaData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the details"
            })
            return;
        };
        console.log("check+++++++++++++++++++++",getMetaData)
        let getUsers = await userService.findUser({ accountId: getMetaData.accountId })
        if (!getUsers) {
            res.send({
                code: constant.errorCode,
                message: "No Users Found!"
            })
        } else {
            const emailRegex = new RegExp(data.email ? data.email : '', 'i')
            const firstNameRegex = new RegExp(data.firstName ? data.firstName : '', 'i')
            const lastNameRegex = new RegExp(data.lastName ? data.lastName : '', 'i')
            const phoneRegex = new RegExp(data.phone ? data.phone : '', 'i')
            const filteredData = getUsers.filter(entry => {
                return (
                    firstNameRegex.test(entry.firstName) &&
                    lastNameRegex.test(entry.lastName) &&
                    emailRegex.test(entry.email) &&
                    phoneRegex.test(entry.phoneNumber)
                );
            });
            // let getServicerStatus = await providerService.getServiceProviderById({ _id: req.params.servicerId }, { status: 1 })
            // if (!getServicerStatus) {
            //     res.send({
            //         code: constant.errorCode,
            //         message: "Invalid servicer ID"
            //     })
            //     return;
            // }
            res.send({
                code: constant.successCode,
                message: "Success",
                result: filteredData,
                // servicerStatus: getServicerStatus.status
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.changePrimaryUser = async(req,res)=>{
    try {
        let data = req.body
        let checkUser = await userService.findOneUser({ _id: req.userId }, {})
        if (!checkUser) {
          res.send({
            code: constant.errorCode,
            message: "Unable to find the user"
          })
          return;
        };
        let updateLastPrimary = await userService.updateSingleUser({ accountId: checkUser.accountId, isPrimary: true }, { isPrimary: false }, { new: true })
        if (!updateLastPrimary) {
          res.send({
            code: constant.errorCode,
            message: "Unable to change tha primary"
          })
          return;
        };
        let updatePrimary = await userService.updateSingleUser({ _id: checkUser._id }, { isPrimary: true }, { new: true })
        if (!updatePrimary) {
          res.send({
            code: constant.errorCode,
            message: "Something went wrong"
          })
        } else {
          res.send({
            code: constant.successCode,
            message: "Updated successfully",
            result: updatePrimary
          })
        }
    
      }catch(err){
        res.send({
            code:constant.errorCode,
            message:err.message
        })
    }
}


