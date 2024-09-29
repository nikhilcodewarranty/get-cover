const mongoose = require("mongoose");
const connection = require('../../db');
const { string } = require("joi");

const dealerBookSchema = new mongoose.Schema({
  priceBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "pricebooks",
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealers",
    index: true
  },
  dealerSku: {
    type: String,
    default: ''
  },
  status: {
    type: Boolean,
    default: false,
    index: true
  },
  retailPrice: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  brokerFee: {
    type: Number,
    default: 0
  },
  adhDays: {
    type: [
      {
        value: {
          type: String
        },
        waitingDays: {
          type: Number
        },
        deductible: {
          type: Number
        },
        amountType: {
          type: String,
          enum: ["amount", "percentage"]
        }
      }
    ]
  },
  unique_key: {
    type: Number,
  },
  wholesalePrice: {
    type: Number,
    default: 0
  },
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
}, { timestamps: true });
module.exports = connection.userConnection.model("dealerPriceBook", dealerBookSchema);



