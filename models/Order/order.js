const { string } = require("joi");
const mongoose = require("mongoose");
const connection = require('../../db')

const orderSchema = new mongoose.Schema({
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
    default:null,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: '',
    index: true
  },
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: '',
    index: true
  },
  venderOrder: {
    type: String,
    default: '',
    index: true
  },
  serviceCoverageType: {
    type: String,
    default: ''
  },
  coverageType: {
    type: [],
  },
  unique_key_number: {
    type: Number,
    index: true
  },
  unique_key_search: {
    type: String,
  },
  unique_key: {
    type: String,
    index: true
  },
  productsArray: {
    type: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        priceBookId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        priceBookDetails: {
          type: {},
          // default:{}
        },
        dealerPriceBookDetails: {
          type: {},
          // default:{}
        },
        unitPrice: {
          type: Number,
        },
        dealerSku: {
          type: String,
          default: ''
        },
        noOfProducts: {
          type: Number,
        },
        priceType: {
          type: String,
          default: ''
        },
        adh: {
          type: Number,
          default: 0
        },
        term: {
          type: Number,
          default: 0
        },
        description: {
          type: String,
          default: ''
        },
        checkNumberProducts: {
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
        isMaxClaimAmount: {
          type: Boolean,
          default: false
        },
        isManufacturerWarranty: {
          type: Boolean,
          default: false
        },
        orderFile: {
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
        QuantityPricing: {
          type: [
            {
              name: {
                type: String,
              },
              quantity: {
                type: Number,
              },
              enterQuantity: {
                type: Number,
              },
            }
          ],
          default: [
            {
              name: '',
              quantity: 0,
              enterQuantity: 0,
            }
          ]
        },
        price: {
          type: Number,
        },
        additionalNotes: {
          type: String,
          default: ''
        },
        rangeStart: {
          type: Number,
          default: ''
        },
        rangeEnd: {
          type: Number,
          default: ''
        },
        coverageStartDate: {
          type: Date,
           default: () => Date.now(),
        },
        coverageStartDate1: {
          type: Date,
           default: () => Date.now(),
        },
        coverageEndDate: {
          type: Date,
          default: '',
        },
        coverageEndDate1: {
          type: Date,
          default: '',
        },
      }
    ]
  },
  orderAmount: {
    type: Number,
    default: 0
  },
  sendNotification: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Unpaid', 'PartlyPaid'],
    default: 'Paid'
  },
  createdBy: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Archieved'],
    default: 'Pending'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  orderDate: {
    type: Date,
    default: () => Date.now()
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    default: 'Manually'
  },
  termCondition: {
    type: {},
    default: {}
  },
  paidDate: {
    type: {
      name: {
        type: String,
      },
      date: {
        type: Date,
      },
    },
    default: {}
  },
  billDetail: {
    type: {
      billTo: {
        type: String,
        default: ''
      },
      detail: {
        type: {},
        default: {}
      }
    }
  },
  canProceed: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });

module.exports = connection.userConnection.model("order", orderSchema);
