const mongoose = require('mongoose')
const Schema = mongoose.Schema

const reseller = new Schema({
    name: {
        type: String,
        default: '',
        index: true
    },
    street: {
        type: String,
        default: ''
    },
    city: {
        type: String,
        default: ''
    },
    isServicer: {
        type: Boolean,
        default: false
    },
    zip: {
        type: String,
        default: ''
    },
    unique_key: {
        type: Number,
    },
    state: {
        type: String,
        default: ''
    },
    country: {
        type: String,
        default: ''
    },
    dealerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "dealers",
    },
    dealerName: {
        type: String,
        default: ''
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    },
    accountStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    token: {
        type: String,
        default: ''
    },
}, { timestamps: true })

module.exports = mongoose.model('reseller', reseller)