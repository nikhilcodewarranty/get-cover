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
        let getData = await mailLogService.getMailLogs()
        if (!getData) {
            res.send({
                code: constant.errorCode,
                message: "Unable to get the data"
            })
        } else {
            res.send({
                code: constant.successCode,
                message: "success",
                result: getData
            })
        }
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

