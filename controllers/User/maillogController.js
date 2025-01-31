const mailLogService = require("../../services/User/maillogServices")
const constant = require("../../config/constant")
const maillogservice = require("../../services/User/maillogServices");


exports.webhookData = async (req, res) => {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++")
    try {
        let data = req.body
        // console.log(data, "+++++++++++++++++++++++++++++++++++++++++++++")
        for (let i = 0; i < data.length; i++) {
            let webhookData = data[i]
            let splitId = webhookData.sg_message_id.split('.')[0]
            let findLog = await mailLogService.getMailLog({ email: webhookData.email, sg_message_id: { '$regex': splitId ? splitId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
            if (findLog) {
                findLog.sg_event_id = webhookData.sg_event_id
                findLog.event = webhookData.event
                findLog.response = webhookData.response
                if (webhookData.event == "dropped") {
                    webhookData.event = "failed"
                }
                function capitalizeFirstLetter(str) {
                    if (!str) return str; // Handle empty string
                    return str.charAt(0).toUpperCase() + str.slice(1);
                }
                webhookData.event = capitalizeFirstLetter(webhookData.event);
                let newValues = {
                    $set: {
                        sg_event_id: webhookData.sg_event_id,
                        event: webhookData.event,
                        response: webhookData.response
                    }
                }
                let updateData = await mailLogService.updateMailLog({ _id: findLog._id }, newValues)
                console.log("update data")
            }

        }
        res.send({
            code: constant.successCode
        })
    } catch (err) {
        console.log("catch errr:-", err.message)
        res.send({
            message: err.stack
        })
    }
}


exports.checkApi = async (req, res) => {
    try {
        console.log("sdhflsjflksjdflksjdflksjdflksjdflksjflskjdf00000000000000000")
    } catch (err) {

    }
}



exports.getMaillogData = async (req, res) => {
    try {

        let data = req.body
        let query = {}
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 10
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        if (data.role != '') {
            query.role = data.role
        }
        if (data.accountName != '') {
            query.accountName = { '$regex': data.accountName ? data.accountName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }
        }
        if (data.status != '') {
            query.event = data.status
        }
        if (data.email != '') {
            query.email = { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' }
        }
        if (data.startDate != "" && data.endDate != "") {
            let start = new Date(data.startDate); // Replace with your start date
            data.endDate = new Date(data.endDate)
            data.endDate.setHours(23, 59, 999, 0)
            query.sentOn = { $gte: new Date(start), $lte: new Date(data.endDate) }
        }
        console.log("query----------------------", query)
        let getData = await mailLogService.getMailLogs(query, pageLimit, skipLimit)
        let getCount = await mailLogService.getMailLogsCount(query)
        if (!getData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the data"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "success",
                result: getData,
                totalCount: getCount
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

