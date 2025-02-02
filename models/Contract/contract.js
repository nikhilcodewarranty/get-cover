const mongoose = require("mongoose");
const connection = require('../../db')
const contractSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "order",
    index: true,
  },
  dealerSku: {
    type: String,
    default: ''
  },
  orderUniqueKey: {
    type: String
  },
  venderOrder: {
    type: String
  },
  productName: {
    type: String,
    index: true,
  },
  pName: {
    type: String,
    index: true,
    default: ''
  },
  serviceCoverageType: {
    type: String,
    default: ''
  },
  coverageType: {
    type: [],
    default: []
  },
  partsWarranty: {
    type: Date,
    default: null
  },
  labourWarranty: {
    type: Date,
    default: null
  },
  purchaseDate: {
    type: Date,
    default: null
  },
  minDate: {
    type: Date,
    default: null
  },
  orderProductId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  model: {
    type: String,
    index: true,
  },
  manufacture: {
    type: String,
    index: true,
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
  productValue: {
    type: String,
  },
  serial: {
    type: String,
    index: true,
  },
  regDate: {
    type: Date,
    default: () => Date.now()
  },
  condition: {
    type: String,
    default: ''
  },
  claimStatus: {
    type: String,
    default: ''
  },
  claimAmount: {
    type: Number,
    default: 0
  },
  eligibilty: {
    type: Boolean,
    default: false
  },
  unique_key: {
    type: String,
    index: true
  },
  coverageStartDate: {
    type: Date,
    default: () => Date.now(),
  },
  coverageEndDate: {
    type: Date,
    default: '',
  },
  coverageStartDate1: {
    type: Date,
    default: () => Date.now(),
  },
  coverageEndDate1: {
    type: Date,
    default: '',
  },
  unique_key_number: {
    type: Number,
    index: true
  },
  unique_key_search: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['Active', 'Waiting', 'Expired', 'Cancelled', 'Refunded', 'Inactive'],
    default: 'Waiting'
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
  isDeleted: {
    type: Boolean,
    default: false
  },
  deductible: {
    type: Number,
    default: 0
  },
  notEligibleByCustom: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });

module.exports = connection.userConnection.model("contract", contractSchema);
