const mongoose = require("mongoose");
const connection = require('../../db')
const servicePriceBookSchema = new mongoose.Schema({
    servicerId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    categoryArray: {
        type: Array,
        default: []
    },
    priceBookArray: {
        type: [],
        default: []
    },

}, { timestamps: true });

module.exports = connection.userConnection.model("servicerpricebooks", servicePriceBookSchema);
