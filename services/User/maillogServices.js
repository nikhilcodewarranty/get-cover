const MAILLOG = require("../../models/User/mailLog")


module.exports = class mailLogService {
    static async createMailLog(data) {
        try {
            let data = req.body
            let maillog = await MAILLOG(data).save()
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }

    static async getMailLog(Query) {
        try {
            let getMailLog = await MAILLOG.findOne(Query)
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }

    static async getMailLogs(Query) {
        try {
            let getMailLog = await MAILLOG.find(Query)
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }

    static async getMailLogsWithAggregate(Query) {
        try {
            let getMailLog = await MAILLOG.aggregate(Query)
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }
    static async updateMailLog(Query, values) {
        try {
            let getMailLog = await MAILLOG.findOneAndUpdate(Query, values, { new: true })
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }
}