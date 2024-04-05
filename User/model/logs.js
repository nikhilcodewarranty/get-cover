const mongoose = require('mongoose')
const Schema = mongoose.Schema

const logs = new Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        default:''
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

module.exports = mongoose.mmodel('logs',logs)