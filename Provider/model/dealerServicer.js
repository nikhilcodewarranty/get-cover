const mongoose = require('mongoose')
const Schema = mongoose.Schema

const servicerDealerRelation = new Schema({
    dealerId:{
        type:mongoose.Schema.Types.ObjectId,ref:'dealers'
    },
    servicerId:{
        type:mongoose.Schema.Types.ObjectId,ref:'serviceproviders'
    },
    status:{
        type:Boolean,
        default:true
    }
},{timestamps:true})

module.exports = mongoose.model('servicer_dealer_relation',servicerDealerRelation)