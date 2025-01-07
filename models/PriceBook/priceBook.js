const mongoose = require("mongoose");
const connection = require('../../db')

const priceSchema = new mongoose.Schema({
  name: {
    type: String,
    index: true,
    trim: true,
  },
  pName: {
    type: String,
    index: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  term: {
    type: Number,
    index: true
  },
  frontingFee: {
    type: Number,
    default:0
  },
  coverageType: {
    type: [],
    default: []
  },
  unique_key: {
    type: Number,
  },
  reserveFutureFee: {
    type: Number,
    default: 0
  },
  reinsuranceFee: {
    type: Number,
    default:0
  },
  adminFee: {
    type: Number,
    default:0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "pricecategories",
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  priceType: {
    type: String,
    enum:['Regular Pricing','Flat Pricing','Quantity Pricing'],
  },
  rangeStart: {
    type: Number,
    default: ''
  },
  rangeEnd: {
    type: Number,
    default: ''
  },
  status: {
    type: Boolean,
    default: true,
    index: true
  },
  quantityPriceDetail: {
    type: [
      {
        name: {
          type: String,
          default: ''
        },
        quantity: {
          type: Number,
          default: 0
        }
      }
    ],
    default: [{ name: '', quantity: '' }]
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = connection.userConnection.model("priceBook", priceSchema);
