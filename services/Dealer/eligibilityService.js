const eligibility = require("../../models/Dealer/eligibilityCriteria")

module.exports = class eligibilityService {
    static async createEligibility(data) {
        try {
            let createEligibity = await eligibility(data).save()
            return createEligibity
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async getEligibility(query) {
        try {
            let createEligibity = await eligibility.findOne(query)
            return createEligibity
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async getEligibilityAggregation(query) {
        try {
            let createEligibity = await eligibility.aggregate(query)
            return createEligibity
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }

    static async updateEligibility(query, data, option) {
        try {
            let updateEligibility = await eligibility.findOneAndUpdate(query, data, option)
            return updateEligibility
        } catch (err) {
            return { code: 401, message: err.message }
        }
    }
}