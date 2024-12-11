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
    date: {
        type: Date,
        default: () => new Date()
    },
    status: {
        type: String,
        enum: ["Pending", "Active"],
        default: "Pending"
    }
}, { timestamps: true })

module.exports = connection.userConnection.model("claimreportings", claimReporting)