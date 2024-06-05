const { string } = require("joi");
const mongoose = require("mongoose");
const connection = require('../../db')

const reportingSchema = new mongoose.Schema({
    orderAmount: {
        type: Number,
        default: 0
    },
    orderId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    },
    products: {
        type: Array,
        default: []
    },
    dealerPriceBook:{
        type:Array,
        default:[]
    },
    dealerId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    }

}, { timestamps: true });

module.exports = connection.reportingConnection.model("order", reportingSchema);