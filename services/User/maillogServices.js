const MAILLOG = require("../../models/User/mailLog")
const userService = require("../../services/User/userService")
const dealerService = require("../../models/Dealer/dealer")
const resellerService = require("../../models/Dealer/reseller")
const servicerService = require("../../models/Provider/serviceProvider")
const customerService = require("../../models/Customer/customer")
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
            // console.log(body, dataFromApi, "******************")
            let mailContent = await axios.get(`https://api.sendgrid.com/v3/templates/${templateId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.sendgrid_key}`,
                    'Content-Type': 'application/json',
                },
            })
            console.log("******************")

            if (body.statusCode == 202) {
                for (let i = 0; i < emails.length; i++) {
                    let checkRole = await userService.getRoleById({ _id: emails[i]?.metaData[0].roleId })
                    console.log("***********fffff*******", checkRole)
                    let role = checkRole.role
                    let userId = emails[i]?.metaData[0]._id
                    let accountName
                    // console.log("******************", emails[i])
                    if (checkRole.role == "Dealer") {
                        let getAccountName = await dealerService.findOne({ _id: emails[i]?.metaData[0].metaId })
                        // console.log("***********fffff*******", getAccountName)
                        accountName = getAccountName.name
                    }
                    if (checkRole.role == "Super Admin") {
                        accountName = emails[i]?.metaData[0].firstName + " " + emails[i]?.metaData[0].lastName

                    }
                    if (checkRole.role == "Servicer") {
                        let getAccountName = await servicerService.findOne({ _id: emails[i]?.metaData[0].metaId })
                        accountName = getAccountName.name
                    }
                    if (checkRole.role == "Reseller") {
                        let getAccountName = await resellerService.findOne({ _id: emails[i]?.metaData[0].metaId })
                        accountName = getAccountName.name
                    }
                    if (checkRole.role == "Customer") {
                        let getAccountName = await customerService.findOne({ _id: emails[i]?.metaData[0].metaId })
                        accountName = getAccountName.username
                    }

                    let mailLogObject = {
                        sg_message_id: body.headers['x-message-id'],
                        email: emails[i]?.email,
                        userId: userId,
                        accountName: accountName,
                        role: role,
                        // sentOn: new Date(body.date),
                        keyValues: dataFromApi,
                        content: mailContent?.data?.versions[0]?.html_content
                    }
                    let maillog = await MAILLOG(mailLogObject).save()
                    // console.log("checking the save data +++++++", mailLogObject)
                }
                console.log("i am hererrrrrrrrrrrrrrrrrrrrrr------------------------")
                return { code: 200, message: "Success" }
            } else {
                console.log("--------------error------------------------------")
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
            let getMailLog = await MAILLOG.find(Query).sort({'createAt': -1})
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