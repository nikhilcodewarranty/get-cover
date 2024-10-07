require("dotenv").config();
const mongoose = require("mongoose");
const connection = require('../../db')
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        default: '',
        index: true,
        lowercase: true
    },
    password: {
        type: String,
        default: process.env.DUMMY_PASSWORD
    },
    notificationTo: {
        type: Array,
        default: []
    },
    metaData: {
        type: [
            {
                metaId: {
                    type: mongoose.Schema.Types.ObjectId,
                },
                status: {
                    type: Boolean,
                    default: false
                },
                roleId: {
                    type: mongoose.Schema.Types.ObjectId,
                },
                firstName: {
                    type: String,
                    default: ""
                },
                lastName: {
                    type: String,
                    default: ''
                },
                phoneNumber: {
                    type: String,
                    default: '',
                    index: true
                },
                position: {
                    type: String,
                    default: ''
                },
                isPrimary: {
                    type: Boolean,
                    default: true
                },
                isDeleted: {
                    type: String,
                    default: false
                },
                dialCode: {
                    type: String,
                    default: '+1'
                }
            }
        ],
    },
    resetPasswordCode: {
        type: String,
        default: null
    },
    isResetPassword: {
        type: Boolean,
        default: false
    },
    approvedStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    }
}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
