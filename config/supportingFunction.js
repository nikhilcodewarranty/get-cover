const mongoose = require('mongoose');
const userService = require('../services/User/userService')
const REPORTING = require('../models/Order/reporting')


exports.getUserIds = async () => {
    const getSuperId = await userService.findUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isDeleted: false, status: true }, {});
    return getSuperId.map(ID => ID._id);
}

exports.websiteSetting = async () => {
    let settingData = await userService.getSetting({});
    return settingData;
}

exports.getUserEmails = async () => {
    const getSuperEmails = await userService.findUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true }, { notificationTo: 1 });
    return getSuperEmails[0]?.notificationTo
}

exports.getPrimaryUser = async (query) => {
    const getSuperId = await userService.getUserById1(query, {});
    return getSuperId

}

exports.reportingData = async (data) => {
    let reportingData = {
        orderId: data.orderId,
        orderAmount: data.orderAmount,
        products: data.products,
        // dealerPriceBook: data.dealerPriceBook,
        dealerId: data.dealerId
    }
    const saveData = await REPORTING(reportingData).save()

    return saveData
}

exports.insertManyReporting = async (data) => {
    try {
        let saveReporting = await REPORTING.insertMany(data)
        return saveReporting
    } catch (err) {
        return { code: 401, message: "Unable to create the data" }
    }
}

exports.checkReportinWithId = async (data) => {
    try {
        let checkId = await REPORTING.findOne(data)
        return checkId
    } catch (err) {
        return { code: 401, message: err.message }
    }
}

exports.checkReporting = async (data) => {
    try {
        let checkId = await REPORTING.find(data)
        return checkId
    } catch (err) {
        return { code: 401, message: err.message }
    }
}

exports.checkObjectId = async (req, res, next) => {
    try {
        function isValidObjectId(id) {
            return mongoose.Types.ObjectId.isValid(id);
        }

        const keys = Object.keys(req.params);

        for (const key of keys) {
            const paramValue = req.params[key];
            if (!isValidObjectId(paramValue)) {
                res.send({
                    code: 401,
                    message: "Invalid ID"
                });
                return
            }
        }

        next();
    } catch (err) {
        return res.status(401).send({
            code: 401,
            message: err.message
        });
    }
}



// module.exports = getUserIds;