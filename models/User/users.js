require("dotenv").config();
const mongoose = require("mongoose");
const connection = require('../../db')
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        default: '',
        index: true,
        lowercase: true
    },
    password: {
        type: String,
        default: process.env.DUMMY_PASSWORD
    },
    threshHoldLimit: {
        type: {
            value: Number,
            amountType: {
                type: String,
                default: "percentage"
            }
        }
    },
    isThreshHoldLimit: {
        type: Boolean,
        default: false
    },
    notificationTo: {
        type: Array,
        default: []
    },
    metaData: {
        type: [
            {
                metaId: {
                    type: mongoose.Schema.Types.ObjectId,
                },
                status: {
                    type: Boolean,
                    default: false
                },
                roleId: {
                    type: mongoose.Schema.Types.ObjectId,
                },
                firstName: {
                    type: String,
                    default: ""
                },
                lastName: {
                    type: String,
                    default: ''
                },
                phoneNumber: {
                    type: String,
                    default: '',
                    index: true
                },
                position: {
                    type: String,
                    default: ''
                },
                isPrimary: {
                    type: Boolean,
                    default: true
                },
                isDeleted: {
                    type: String,
                    default: false
                },
                dialCode: {
                    type: String,
                    default: '+1'
                },
                orderNotifications: {
                    type: {
                        addingNewOrderPending: {
                            type: Boolean,
                            default: true
                        },
                        addingNewOrderActive: {
                            type: Boolean,
                            default: true
                        },
                        makingOrderPaid: {
                            type: Boolean,
                            default: true
                        },
                        updateOrderPending: {
                            type: Boolean,
                            default: true
                        },
                        updateOrderActive: {
                            type: Boolean,
                            default: true
                        },
                        archivinOrder: {
                            type: Boolean,
                            default: true
                        },
                    },
                    default: {
                        addingNewOrderPending: true,
                        addingNewOrderActive: true,
                        makingOrderPaid: true,
                        updateOrderPending: true,
                        updateOrderActive: true,
                        archivinOrder: true,
                    }
                },
                claimNotification: {
                    type: {
                        newClaim: {
                            type: Boolean,
                            default: true
                        },
                        fileBulkClaim: {
                            type: Boolean,
                            default: true
                        },
                        servicerUpdate: {
                            type: Boolean,
                            default: true
                        },
                        customerStatusUpdate: {
                            type: Boolean,
                            default: true
                        },
                        repairStatusUpdate: {
                            type: Boolean,
                            default: true
                        },
                        claimStatusUpdate: {
                            type: Boolean,
                            default: true
                        },
                        partsUpdate: {
                            type: Boolean,
                            default: true
                        },
                        claimComment: {
                            type: Boolean,
                            default: true
                        },

                    },
                    default: {
                        newClaim: true,
                        fileBulkClaim: true,
                        servicerUpdate: true,
                        customerStatusUpdate: true,
                        repairStatusUpdate: true,
                        claimStatusUpdate: true,
                        partsUpdate: true,
                        claimComment: true
                    }
                },
                adminNotification: {
                    type: {
                        userAdded: {
                            type: "Boolean",
                            default: true
                        },
                        categoryUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        priceBookUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        priceBookAdd: {
                            type: "Boolean",
                            default: true
                        },
                        unassignDealerServicer: {
                            type: "Boolean",
                            default: true
                        },
                        assignDealerServicer: {
                            type: "Boolean",
                            default: true
                        },
                        categoryAdded: {
                            type: "Boolean",
                            default: true
                        }
                    },
                    default: {
                        newUserCreated: true,
                        categoryUpdate: true,
                        priceBookUpdate: true,
                        priceBookAdd: true,
                        unassignDealerServicer: true,
                        assignDealerServicer: true,
                        categoryAdded: true
                    }
                },
                servicerNotification: {
                    type: {
                        servicerAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        primaryChanged: {
                            type: "Boolean",
                            default: true
                        },
                        userDelete: {
                            type: "Boolean",
                            default: true
                        },
                    },
                    default: {
                        servicerAdded: true,
                        userAdded: true,
                        userUpdate: true,
                        primaryUpdate: true,
                        userDelete: true,
                    }
                },
                dealerNotifications: {
                    type: {
                        dealerAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        primaryChanged: {
                            type: "Boolean",
                            default: true
                        },
                        userDelete: {
                            type: "Boolean",
                            default: true
                        },
                        dealerPriceBookUpload: {
                            type: "Boolean",
                            default: true
                        },
                        dealerPriceBookAdd: {
                            type: "Boolean",
                            default: true
                        },
                        dealerPriceBookUpdate: {
                            type: "Boolean",
                            default: true
                        },
                    },
                    default: {
                        dealerAdded: true,
                        userAdded: true,
                        userUpdate: true,
                        primaryChanged: true,
                        userDelete: true,
                        dealerPriceBookUpload: true,
                        dealerPriceBookAdd: true,
                        dealerPriceBookUpdate: true,
                    }
                },
                resellerNotifications: {
                    type: {
                        resellerAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userAdd: {
                            type: "Boolean",
                            default: true
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        primaryChange: {
                            type: "Boolean",
                            default: true
                        },
                        userDelete: {
                            type: "Boolean",
                            default: true
                        }
                    },
                    default: {
                        resellerAdded: true,
                        userAdd: true,
                        userUpdate: true,
                        primaryChange: true,
                        userDelete: true,
                    }
                },
                customerNotifications: {
                    type: {
                        customerAdded: {
                            type: "Boolean",
                            default: true
                        },
                        userAdd: {
                            type: "Boolean",
                            default: true
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: true
                        },
                        primaryChange: {
                            type: "Boolean",
                            default: true
                        },
                        userDelete: {
                            type: "Boolean",
                            default: true
                        }
                    },
                    default: {
                        customerAdded: true,
                        userAdd: true,
                        userUpdate: true,
                        primaryChange: true,
                        userDelete: true,
                    }
                },
                registerNotifications: {
                    type: {
                        dealerRegistrationRequest: {
                            type: "Boolean",
                            default: true
                        },
                        servicerRegistrationRequest: {
                            type: "Boolean",
                            default: true
                        },
                        dealerDisapproved: {
                            type: "Boolean",
                            default: true
                        },
                        servicerDisapproved: {
                            type: "Boolean",
                            default: true
                        },
                    },
                    default: {
                        dealerRegistrationRequest: true,
                        dealerServicerRequest: true,
                        dealerDisapproved: true,
                        servicerDisapproved: true,
                    }
                }
            }
        ],
    },
    resetPasswordCode: {
        type: String,
        default: null
    },
    isResetPassword: {
        type: Boolean,
        default: false
    },

    approvedStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    }
}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
