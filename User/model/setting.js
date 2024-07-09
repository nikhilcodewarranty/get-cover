const mongoose = require("mongoose");
const connection = require('../../db')
const settingSchema = new mongoose.Schema({
    logos: {
        type: [
            {
                logoImage: {
                    type: {
                        fileName: {
                            type: String,
                            default: ''
                        },
                        name: {
                            type: String,
                            default: ''
                        },
                        size: {
                            type: String,
                            default: ''
                        },
                    },
                    default: {}
                },
                logoType: {
                    type: String,
                    default: ''
                },
            },

        ]
    },
    favIcon: {
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
    }
});
module.exports = connection.userConnection.model("setting", settingSchema);
