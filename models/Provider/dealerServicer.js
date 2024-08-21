const mongoose = require('mongoose')
const Schema = mongoose.Schema
const connection = require('../../db')

const servicerDealerRelation = new Schema({
    dealerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'dealers'
    },
    servicerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'serviceproviders'
    },
    status:{
        type:Boolean,
        default:true
    }
},{timestamps:true})

module.exports = connection.userConnection.model('servicer_dealer_relation',servicerDealerRelation)