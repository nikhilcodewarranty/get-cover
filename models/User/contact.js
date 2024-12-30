const mongoose = require('mongoose')
const Schema = mongoose.Schema
const connection = require('../../db')

const contactUs = new Schema({
    firstName: {
        type: String,
        default: ""
    },
    lastName: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    phoneNumber: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        default: ""
    },
    products: {
        type: array,
    }

}, { timestamps: true })

module.exports = connection.userConnection.model('contact', contactUs)