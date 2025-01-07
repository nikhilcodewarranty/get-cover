const options = require("../../models/User/options")


module.exports = class eligibilityService {
    static async createOptions(data) {
        try {
            let createOption = await new options(data).save()
            return createOption
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async getOption(query) {
        try {
            let getOption = await options.findOne(query)
            return getOption
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async getOptionsAggregation(query) {
        try {
            let getOptions = await options.aggregate(query)
            return getOptions
        }
         catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async updateEligibility(query, data, option) {
        try {
            let updateOptions = await options.findOneAndUpdate(query, data, option)
            return updateOptions
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }
}