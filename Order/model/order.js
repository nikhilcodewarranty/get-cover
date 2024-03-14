const { string } = require("joi");
const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({

  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: '',
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: '',
    index:true
  },
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: '',
    index:true
  },
  venderOrder: {
    type: String,
    default: '',
    index:true
  },
  serviceCoverageType: {
    type: String,
    default: ''
  },
  coverageType: {
    type: String,
    default: ''
  },
  unique_key_number: {
    type: Number,
    index:true
  },
  unique_key_search: {
    type: String,
  },
  unique_key: {
    type: String,
    index:true
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
        unitPrice: {
          type: Number,
        },
        noOfProducts: {
          type: Number,
        },
        priceType: {
          type: String,
          default: ''
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
          default: Date.now(),
        },
        coverageEndDate: {
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
    default: Date.now(),
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
  canProceed: {
    type: Boolean,
    default: false
  },
  // dealerId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "dealer",
  // },
  // serviceprovId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "serviceProvider",
  // },
  // customerId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "customer",
  // },
  // orderAmount: {
  //   type: Number,
  // },
  // paymentMethod: {
  //   type: String,
  // },
  // paymentStatus: {
  //   type: String,
  // },
  // paidAmount: {
  //   type: Number,
  // },
  // dueAmount: {
  //   type: Number,
  // },
  // orderDate: {
  //   type: Date,
  //   default: Date.now,
  // },
  // createdBy: {
  //   type: String,
  // },
  // venderOrder: {
  //   type: String,
  // },
  // coverageStartDate: {
  //   type: Date,
  // },
  // serviceCoverageType: {
  //   type: String,
  // },
  // CoverageType: {
  //   type: String,
  // },
  // additionalNotes: {
  //   type: String,
  // },
  // status:{
  //   type:Boolean,
  //   default:true
  // },
  // noOfProducts:{
  //   type: Number,
  //   default:0
  // },
  // isDeleted:{
  //   type:Boolean,
  //   default:false
  // },
  // sendNotification: {
  //   type: Boolean,
  //   default:false
  // },
}, { timestamps: true });

module.exports = mongoose.model("order", orderSchema);
