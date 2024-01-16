const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({

  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealer",
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
   default:''
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    default:new mongoose.Types.ObjectId('61c8c7d38e67bb7c7f7effee')
  },
  dealerPurchaseOrder: {
    type: String,
    default: ''
  },
  serviceCoverageType: {
    type: String,
    default: ''
  },
  coverageType: {
    type: String,
    default: ''
  },
  unique_key: {
    type: Number,
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
        price: {
          type: Number,
        },
        additionalNotes: {
          type: String,
          default: ''
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
    enum: ['Paid', 'Unpaid', 'Partly Paid'],
    default: 'Paid'
  },
  createdBy: {
    type: String,
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  orderDate: {
    type: Date,
    default: Date.now(),
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
  // waitPeriodBd: {
  //   type: Number,
  // },
  // waitPeriodAdh: {
  //   type: Number,
  //   ref: "dealer",
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
