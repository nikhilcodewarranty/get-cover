const MAILLOG = require("../../models/User/mailLog")
const axios = require("axios")


module.exports = class mailLogService {
    static async createMailLog(data) {
        try {
            // let data = req.body
            let maillog = await MAILLOG(data).save()
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }

    static async createMailLogFunction(dataFromSendgrid, dataFromApi, emails, templateId) {
        try {
            let body = dataFromSendgrid[0]
            console.log(body, dataFromApi, "******************")
            let mailContent = await axios.get(`https://api.sendgrid.com/v3/templates/${templateId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.sendgrid_key}`,
                    'Content-Type': 'application/json',
                },
            })
            console.log(body.Response, dataFromApi, "******************")

            if (body.statusCode == 202) {
                for (let i = 0; i < emails.length; i++) {
                    let mailLogObject = {
                        sg_message_id: body.headers['x-message-id'],
                        email: emails[i],
                        // sentOn: new Date(body.date),
                        keyValues: dataFromApi,
                        content: mailContent?.data?.versions[0]?.html_content
                    }
                    let maillog = await MAILLOG(mailLogObject).save()
                    // console.log("checking the save data +++++++", mailLogObject)
                }
                return { code: 200, message: "Success" }
            } else {
                return { code: 401, message: "Mail not sent" }
            }

        } catch (err) {
            console.log("catch error------------", err.stack)
            return { code: 401, message: err.message }
        }
    }


    static async getMailLog(Query) {
        try {
            let getMailLog = await MAILLOG.findOne(Query)
            return getMailLog
        } catch (err) {
            console.log("catch error------------", err.stack)
        }
    }

    static async getMailLogs(Query) {
        try {
            let getMailLog = await MAILLOG.find(Query)
            return getMailLog
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