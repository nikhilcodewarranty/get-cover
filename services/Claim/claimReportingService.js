const claimReporting = require("../../models/Claim/claimReporting")


module.exports = class claimReportingService {
    static async createReporting(data) {
        try {
            const createReporting = await claimReporting(data).save()
            return createReporting;
        } catch (err) {
            console.log("Claim reporting service error", err.message)
        }

    }

    static async updateReporting(criteria, values, option) {
        try {
            let updateReporting = await claimReporting.findOneAndUpdate(criteria, values, option)
            return updateReporting
        } catch (err) {
            console.log("Update reporting service error", err.message)
        }
    }

    static async getClaimReportings(query) {
        try {
            let getClaimReporting = await claimReporting.find(query)
            return getClaimReporting
        } catch (err) {
            console.log("Claim reporting service error", err.message)
        }
    }

    static async getClaimReporting(query) {
        try {
            let getClaimReporting = await claimReporting.findOne(query)
            return getClaimReporting
        } catch (err) {
            console.log("Claim reporting service error", err.message)
        }
    }

    static async deleteReporting(query) {
        try {
            let deleteReporting = await claimReporting.findOneAndDelete(query)
            return deleteReporting
        } catch (err) {
            console.log("Claim reporting service error", err.message)
        }
    }
}