const mongoose = require("mongoose")
const Schema = mongoose.Schema
const connection = require('../../db');

const reportingKeys = new Schema({
    userId: {
        type: String,
        default: null
    },
    claimKeys: {
        type: Object
    },
    contractKeys: {
        type: Object
    }
}, { timestamps: true })

module.exports = connection.userConnection.model("reportingkeys", reportingKeys)
