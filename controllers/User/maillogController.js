const mailLogService = require("../../services/User/maillogServices")
const constant = require("../../config/constant");


console.log("sljdhlsjflskdjflksjdflksjdf")
exports.webhookData = async (req, res) => {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++")
    try {
        let data = req.body
        console.log(data, "+++++++++++++++++++++++++++++++++++++++++++++")
        for (let i=0;i<data.length;i++) {
            
        }
        res.send({
            code: "5555"
        })
    } catch (err) {
        console.log("catch errr:-", err.message)
        res.send({
            message: err.message
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

