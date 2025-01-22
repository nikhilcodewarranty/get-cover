const mailLogService = require("../../services/User/maillogServices")


console.log("sljdhlsjflskdjflksjdflksjdf")
exports.webhookData = async (req, res) => {
        console.log( "+++++++++++++++++++++++++++++++++++++++++++++")
        try {
        let data = req.body
        console.log(data, "+++++++++++++++++++++++++++++++++++++++++++++")
        res.send({
            code:"5555"
        })
    } catch (err) {
        console.log("catch errr:-", err.message)
        res.send({
            message: err.message
        })
    }
}


exports.checkApi = async(req,res)=>{
    try{
        console.log("sdhflsjflksjdflksjdflksjdflksjdflksjflskjdf00000000000000000")
    }catch(err){

    }
}

