const { string } = require("joi");
const mongoose = require("mongoose");
const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contracts",
    index: true
    // required: true,
  },
  orderId: {
    type: String,
    default: '',
    index: true
  },
  venderOrder: {
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
    enum: ['Open', 'Completed', 'Rejected'],
    default: 'Open',
    index: true
    // required: true,
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
    ref: "serviceproviders",
    default: null,
    index: true
  },
  action: {
    type: String,
    default: ''
    // required: true,
  },
  bdAdh: {
    type: String,
    default: ''
    // required: true,
  },
  diagnosis: {
    type: String,
    // required: true,
  },
  receiptImage: {
    type: [],
    default: []
  },
  shippingCarrier: {
    type: String,
    default: ''
    // required: true,
  },
  shippingLabel: {
    type: String,
    default: ''
    // required: true,
  },
  claimDate: {
    type: Date,
    default: Date.now()
    // required: true,
  },
  lossDate: {
    type: Date,
    default: Date.now()
    // required: true,
  },
  claimType: {
    type: String,
    default: 'New'
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
  // comments: {
  //   type: [
  //     {
  //       commentedBy: {
  //         type: String,
  //       },
  //       type:{
  //         type:String
  //       },
  //       commentedTo: {
  //         type: String,
  //       },
  //       content: {
  //         type: String,
  //       },
  //       messageFile: {
  //         type: {
  //           fileName: {
  //             type: String,
  //             default: ''
  //           },
  //           originalname: {
  //             type: String,
  //             default: ''
  //           },
  //           size: {
  //             type: String,
  //             default: ''
  //           },
  //         },
  //         default: {
  //           fileName: '',
  //           originalName: '',
  //         }
  //       },
  //       date: {
  //         type: Date,
  //         default: Date.now()
  //       }
  //     }
  //   ],
  //   default: [ ]
  // },
  totalAmount: {
    type: Number,
    default: 0
    // required: true,
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
          default: 'Request Submitted'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [{
      status: 'Request Submitted',
      date: Date.now()
    }]
  },
  trackStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Request Submitted'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [
      {
        status: 'Open',
        date: Date.now()
      },
      {
        status: 'Request Submitted',
        date: Date.now()
      },
      {
        status: 'Request Sent',
        date: Date.now()
      },
    ]
  },
  claimStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Open'
        },
        date: {
          type: Date,
          default: Date.now()

        }
      },
    ],
    default: [{
      status: 'Open',
      date: Date.now()
    }]
  },
  repairStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Request Approved'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [{
      status: 'Request Sent',
      date: Date.now()
    }]
  },
}, { timestamps: true });

module.exports = mongoose.model("claim", claimSchema);
