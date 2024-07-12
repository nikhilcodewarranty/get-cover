const mongoose = require("mongoose");
const connection = require('../../db')
const settingSchema = new mongoose.Schema({
    logoLight: {
        type: {},
        default: {}
    },
    logoDark: {
        type: {},
        default: {}
    },
    favIcon: {
        type: {},
        default: {}
    },
    title: {
        type: String,
        default: ''
    },
    colorScheme: {
        type: [
            {
                colorCode: {
                    type: String,
                    default: ''
                },
                colorType: {
                    type: String,
                    default: ''
                }
            }
        ]
    },
    address: {
        type: String,
        default: ''
    },
    paymentDetail: {
        type: String,
        default: ''
    }

});
module.exports = connection.userConnection.model("setting", settingSchema);
