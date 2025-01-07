const mongoose = require("mongoose")
const connections = require("../../db")
const eligibilityCriteria = mongoose.Schema({
    noOfClaimPerPeriod: {
        type: Number,
        default: 0
    },
    noOfClaim: {
        type: {
            period: {
                type: String,
                enum: ["Monthly", "Annually"],
                default: "Monthly"
            },
            value: {
                type: Number,
                default: -1
            }
        },
    },
    isManufacturerWarranty: {
        type: Boolean,
        default: false
    },
    isMaxClaimAmount: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true })

module.exports = connections.userConnection.model("eligibilticriterias", eligibilityCriteria)