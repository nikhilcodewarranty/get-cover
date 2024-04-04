const mongoose = require('mongoose')
const Schema = mongoose.Schema

const logs = new Schema({
    token:{
        type:String,
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