const mongoose = require("mongoose");
const connection = require('../../db')

const customerAddressSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    address: {
        street: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        state: {
            type: String,
            default: ''
        },
        zip: {
            type: String,
            default: ''
        },
        status:{
            type:Boolean,
            default:false
        }
    },
    isPrimary:{
        type:Boolean,
        default:false
    }
}, { timestamps: true });

module.exports = connection.userConnection.model("customer_addresses", customerAddressSchema);
