const mongoose = require('mongoose')
const Schema = mongoose.Schema

const mailLogs = new Schema({
    email:{
        type:String
    },
    content:{
        type:String
    },
    smtp_id:{
        type:String
    },
    sg_message_id:{
        type:String
    },
    sentOn:{
        type:Date,
        default:()=>Date.now()
    },
    event:{
        type:String,
        default:"Sent"
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    }
   
},{timestamps:true})

module.exports = mongoose.model("maillogs",mailLogs)