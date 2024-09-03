const mongoose = require('mongoose')
const Schema = mongoose.Schema
const connection = require('../../db')

const logs = new Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        default:"aaaaaaa833011167aaaaaaaa"
    },
    endpoint:{
        type:String,
        default:''
    },
    body:{
        type:{},
        default:{}
    },
    response:{
        type:{},
        default:{}
    }
},{timestamps:true})

module.exports = connection.userConnection.model('logs',logs)