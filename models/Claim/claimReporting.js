const mongoose = require("mongoose")
const Schema = mongoose.Schema
const connection = require('../../db')

const claimReporting = new Schema({
    userId: {
        type: Schema.Types.ObjectId, ref: "users",
        default: null
    },
    fileName: {
        type: String,
        default: ""
    },
    filePath: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        enum: ["claimReporting"],
        default: "claimReporting"
    },
    reportName: {
        type: String,
        default: ""
    },
    remark: {
        type: String,
        default: ""
    },
    lastDownloadTime: {
        type: Date,
    },
    date: {
        type: Date,
        default: () => new Date()
    },
    status: {
        type: String,
        enum: ["Pending", "Active", "Failed"],
        default: "Pending"
    }
}, { timestamps: true })

module.exports = connection.userConnection.model("claimreportings", claimReporting)