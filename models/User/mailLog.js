const mongoose = require('mongoose')
const Schema = mongoose.Schema
const connection = require('../../db')

const mailLogs = new Schema({
    email: {
        type: String,
        default: ""
    },
    content: {
        type: String,
        default: ""
    },
    keysValues: {
        type: {},
        default: {}
    },
    smtp_id: {
        type: String,
        default: ""
    },
    sg_message_id: {
        type: String,
        default: ""
    },
    sentOn: {
        type: Date,
        default: () => Date.now()
    },
    event: {
        type: String,
        default: "Sent"
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    isShow: {
        type: Boolean,
        default: false
    }

}, { timestamps: true })

module.exports = connection.userConnection.model("maillogs", mailLogs)