const { string } = require("joi");
const mongoose = require("mongoose");
const connection = require('../../db')

const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contracts",
    index: true
  },
  orderId: {
    type: String,
    default: '',
    index: true
  },
  dealerSku: {
    type: String,
    default: ''
  },
  venderOrder: {
    type: String,
    default: ''
  },
  submittedBy: {
    type: String,
    default: ''
  },
  shippingTo: {
    type: String,
    default: ''
  },
  serial: {
    type: String,
    default: ''
  },
  productName: {
    type: String,
    default: ''
  },
  approveDate: {
    type: Date,
    default: ''
  },
  pName: {
    type: String,
    default: ''
  },
  shippingTo: {
    type: String,
    default: ''
  },
  submittedBy: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  manufacture: {
    type: String,
    default: ''
  },

  claimFile: {
    type: 'String',
    enum: ['open', 'completed', 'rejected'],
    default: 'open',
    index: true
  },

  reason: {
    type: 'String',
    default: '',
  },
  unique_key_number: {
    type: Number,
  },
  unique_key_search: {
    type: String,
  },
  unique_key: {
    type: String,
    index: true
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealers",
    default: null,
    index: true
  },
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "resellers",
    default: null,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "customers",
    default: null,
    index: true
  },
  action: {
    type: String,
    default: ''
  },
  bdAdh: {
    type: String,
    default: ''
  },
  diagnosis: {
    type: String,
  },
  receiptImage: {
    type: [],
    default: []
  },
  preRepairImage: {
    type: [],
    default: []
  },
  postRepairImage: {
    type: [],
    default: []
  },
  shippingCarrier: {
    type: String,
    default: ''
  },
  shippingLabel: {
    type: String,
    default: ''
  },
  claimDate: {
    type: Date,
    default:null
  },
  lossDate: {
    type: Date,
    default: () => Date.now()
  },
  claimType: {
    type: String,
    default: ''
  },
  trackingNumber: {
    type: String,
    default: ''
  },
  trackingType: {
    type: String,
    default: ''
  },
  servicePaymentStatus: {
    type: String,
    default: 'Pending'
  },
  claimPaymentStatus: {
    type: String,
    default: 'Unpaid',
    enum: ['Paid', 'Unpaid'],

  },
  shippingAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  repairParts: {
    type: [],
    default: []
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  customerOverAmount: {
    type: Number,
    default: 0
  },
  getcoverOverAmount: {
    type: Number,
    default: 0
  },
  customerClaimAmount: {
    type: Number,
    default: 0
  },
  getCoverClaimAmount: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
  },
  customerStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'request_submitted'
        },
        date: {
          type: Date,
          default: () => Date.now()
        }
      },
    ],
    default: [{
      status: 'request_submitted',
      default: () => Date.now()
    }]
  },
  trackStatus: {
    type: [
      {
        status: {
          type: String,
        },
        statusName: {
          type: String,
         
        },
        date: {
          type: Date,
        },
        userId:{
          type: mongoose.Schema.Types.ObjectId,
          default:null
        }
      },
    ],
    default: [
      {
        status: 'open',
        statusName:"claim_status",   
        date: () => Date.now(),
      },
      {
        status: 'request_submitted',
        statusName:"customer_status",        
        date: () => Date.now()
      },
      {
        status: 'request_sent',
        statusName:"repair_status",
        date: () => Date.now() 
      },
    ]
  },
  claimStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'open'
        },
        date: {
          type: Date,
          default: () => Date.now()

        }
      },
    ],
    default: [{
      status: 'open',
      default: () => Date.now()
    }]
  },
  repairStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'request_sent'
        },
        date: {
          type: Date,
          default: () => Date.now()
        }
      },
    ],
    default: [{
      status: 'request_sent',
      default: () => Date.now()
    }]
  },
}, { timestamps: true });


claimSchema.pre('save', function (next) {
  // Define the fields that need to be set to 00:00
  const dateFields = ['claimDate', 'lossDate'];

  // Loop through each date field and set it to midnight if it exists
  dateFields.forEach((field) => {
    if (this[field]) {
      this[field].setHours(0, 0, 0, 0);
    }
  });

  next();
});

module.exports = connection.userConnection.model("claim", claimSchema);
