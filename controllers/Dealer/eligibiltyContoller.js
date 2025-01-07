const eligibilityService = require("../../services/Dealer/eligibilityService")
const dealerService = require("../../services/Dealer/dealerService")
const userService = require("../../services/User/userService")
const orderService = require("../../services/Order/orderService")
const constants = require("../../config/constant")
const mongoose = require("mongoose")

exports.createEligibility = async (req, res) => {
    try {
        let data = req.body
        let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        data.dealerId = checkDealer._id
        let createCriteria = await eligibilityService.createEligibility(data)
        if (!createCriteria) {
            res.send({
                code: constants.errorCode,
                message: "Unable to create the eligibilty"
            })
        } else {
            res.send({
                code: constants.successCode,
                message: "Eligibility created successfully",
                result: createCriteria
            })
        }
    } catch (err) {
        res.send({
            code: constants.errorCode,
            message: err.message
        })
    }
}

exports.getEligibility = async (req, res) => {
    try {
        let data = req.body
        let getEligibility = await eligibilityService.getEligibilityAggregation([
            {
                $project: {
                    __v: 0
                }
            }
        ])
        if (!getEligibility) {
            res.send({
                code: constants.errorCode,
                message: "Unable to get the eligibilties"
            })
        } else {
            res.send({
                code: constants.successCode,
                message: "Success",
                eligibilities: getEligibility
            })
        }
    } catch (err) {
        res.send({
            code: constants.errorCode,
            message: err.message
        })
    }
}





