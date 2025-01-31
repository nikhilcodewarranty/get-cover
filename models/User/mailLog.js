const mongoose = require('mongoose')
const Schema = mongoose.Schema
const connection = require('../../db')

const mailLogs = new Schema({
    email: {
        type: String,
        default: "",
        index:true
    },
    accountName:{
        type: String,
        default:"",
        index:true
    },
    role:{
        type:String,
        default:null,
        index:true
    },
    content: {
        type: String,
        default: ""
    },
    keyValues: {
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
        default: () => Date.now(),
        index:true
    },
    event: {
        type: String,
        default: "Sent",
        index:true
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