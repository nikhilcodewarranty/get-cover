const { string } = require("joi");
const mongoose = require("mongoose");
const commentSchema = new mongoose.Schema({
    claimId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "claims",
        // required: true,
    },
    commentedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    commentedTo: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    commentedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    content: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        default: ''
    },
    messageFile: {
        type: {
            fileName: {
                type: String,
                default: ''
            },
            originalName: {
                type: String,
                default: ''
            },
            size: {
                type: String,
                default: ''
            },
        },
        default: {
            fileName: '',
            originalName: '',
            size: ''
        }
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("comment", commentSchema);