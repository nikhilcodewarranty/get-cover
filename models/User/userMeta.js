const mongoose = require("mongoose");
const connection = require('../../db')

const userMetaSchema = new mongoose.Schema({
    name: {
        type: String,
        default: '',
        index: true
    },
    userName: {
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
    userAccount: {
        type: Boolean,
        default: false
    },
    zip: {
        type: Number,
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
    token: {
        type: String,
        default: ''
    },
    createdBy: {
        type: String,
        default: ''
    },
    accountStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },
    status: {
        type: Boolean,
        default: false
    },
    isServicer: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: String,
        default: false
    },
    role: {
        type: String,
    }
}, { timestamps: true });

// module.exports = connection.userConnection.model("userMeta", userMetaSchema);
