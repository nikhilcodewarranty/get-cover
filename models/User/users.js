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
                            default: false
                        },
                        addingNewOrderActive: {
                            type: Boolean,
                            default: false
                        },
                        makingOrderPaid: {
                            type: Boolean,
                            default: false
                        },
                        updateOrderPending: {
                            type: Boolean,
                            default: false
                        },
                        updateOrderActive: {
                            type: Boolean,
                            default: false
                        },
                        archivinOrder: {
                            type: Boolean,
                            default: false
                        },
                    },
                    default: {
                        addingNewOrderPending: false,
                        addingNewOrderActive: false,
                        makingOrderPaid: false,
                        updateOrderPending: false,
                        updateOrderActive: false,
                        archivinOrder: false,
                    }
                },
                claimNotification: {
                    type: {
                        newClaim: {
                            type: Boolean,
                            default: false
                        },
                        fileBulkClaim: {
                            type: Boolean,
                            default: false
                        },
                        servicerUpdate: {
                            type: Boolean,
                            default: false
                        },
                        customerStatusUpdate: {
                            type: Boolean,
                            default: false
                        },
                        repairStatusUpdate: {
                            type: Boolean,
                            default: false
                        },
                        claimStatusUpdate: {
                            type: Boolean,
                            default: false
                        },
                        partsUpdate: {
                            type: Boolean,
                            default: false
                        },
                        claimComment: {
                            type: Boolean,
                            default: false
                        },

                    },
                    default: {
                        newClaim: false,
                        fileBulkClaim: false,
                        servicerUpdate: false,
                        customerStatusUpdate: false,
                        repairStatusUpdate: false,
                        claimStatusUpdate: false,
                        partsUpdate: false,
                        claimComment: false
                    }
                },
                adminNotification: {
                    type: {
                        userAdded: {
                            type: "Boolean",
                            default: false
                        },
                        categoryUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        priceBookUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        priceBookAdd: {
                            type: "Boolean",
                            default: false
                        },
                        unassignDealerServicer: {
                            type: "Boolean",
                            default: false
                        },
                        assignDealerServicer: {
                            type: "Boolean",
                            default: false
                        },
                        categoryAdded: {
                            type: "Boolean",
                            default: false
                        }
                    },
                    default: {
                        newUserCreated: false,
                        categoryUpdate: false,
                        priceBookUpdate: false,
                        priceBookAdd: false,
                        unassignDealerServicer: false,
                        assignDealerServicer: false,
                        categoryAdded: false
                    }
                },
                servicerNotification: {
                    type: {
                        servicerAdded: {
                            type: "Boolean",
                            default: false
                        },
                        servicerUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        userAdded: {
                            type: "Boolean",
                            default: false
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        primaryChanged: {
                            type: "Boolean",
                            default: false
                        },
                        userDelete: {
                            type: "Boolean",
                            default: false
                        },
                    },
                    default: {
                        servicerAdded: false,
                        userAdded: false,
                        userUpdate: false,
                        primaryUpdate: false,
                        userDelete: false
                    }
                },

                dealerNotifications: {
                    type: {
                        dealerAdded: {
                            type: "Boolean",
                            default: false
                        },
                        dealerUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        userAdded: {
                            type: "Boolean",
                            default: false
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        primaryChanged: {
                            type: "Boolean",
                            default: false
                        },
                        userDelete: {
                            type: "Boolean",
                            default: false
                        },
                        dealerPriceBookUpload: {
                            type: "Boolean",
                            default: false
                        },
                        dealerPriceBookAdd: {
                            type: "Boolean",
                            default: false
                        },
                        dealerPriceBookUpdate: {
                            type: "Boolean",
                            default: false
                        },
                    },
                    default: {
                        dealerAdded: false,
                        userAdded: false,
                        userUpdate: false,
                        primaryChanged: false,
                        userDelete: false,
                        dealerPriceBookUpload: false,
                        dealerPriceBookAdd: false,
                        dealerPriceBookUpdate: false,
                    }
                },
                resellerNotifications: {
                    type: {
                        resellerAdded: {
                            type: "Boolean",
                            default: false
                        },
                        resellerUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        userAdd: {
                            type: "Boolean",
                            default: false
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        primaryChange: {
                            type: "Boolean",
                            default: false
                        },
                        userDelete: {
                            type: "Boolean",
                            default: false
                        }
                    },
                    default: {
                        resellerAdded: false,
                        userAdd: false,
                        userUpdate: false,
                        primaryChange: false,
                        userDelete: false,
                    }
                },
                customerNotifications: {
                    type: {
                        customerAdded: {
                            type: "Boolean",
                            default: false
                        },
                        customerUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        userAdd: {
                            type: "Boolean",
                            default: false
                        },
                        userUpdate: {
                            type: "Boolean",
                            default: false
                        },
                        primaryChange: {
                            type: "Boolean",
                            default: false
                        },
                        userDelete: {
                            type: "Boolean",
                            default: false
                        }
                    },
                    default: {
                        customerAdded: false,
                        userAdd: false,
                        userUpdate: false,
                        primaryChange: false,
                        userDelete: false,
                    }
                },
                registerNotifications: {
                    type: {
                        dealerRegistrationRequest: {
                            type: "Boolean",
                            default: false
                        },
                        servicerRegistrationRequest: {
                            type: "Boolean",
                            default: false
                        },
                        dealerDisapproved: {
                            type: "Boolean",
                            default: false
                        },
                        servicerDisapproved: {
                            type: "Boolean",
                            default: false
                        },
                        contactFormB2c: {
                            type: "Boolean",
                            default: false
                        }
                    },
                    default: {
                        dealerRegistrationRequest: false,
                        dealerServicerRequest: false,
                        dealerDisapproved: false,
                        servicerDisapproved: false,
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

// Helper function to set all notification keys to true
const setAllNotificationsTrue = (notificationObj) => {
    console.log("checking the function ------model++++++++++++++++++++++", notificationObj)
    if (!notificationObj || typeof notificationObj !== "object") return {};
    return Object.keys(notificationObj).reduce((acc, key) => {
        acc[key] = true;
        return acc;
    }, {});
};

// Middleware to update notifications before saving
userSchema.pre("save", function (next) {
    if (this.metaData && Array.isArray(this.metaData)) {
        this.metaData = this.metaData.map((meta) => {
            if (meta.isPrimary) {
                console.log("checking the function ------222222222222222++++++++++++++++++++++", meta)
                return {
                    ...meta,
                    orderNotifications: setAllNotificationsTrue(meta.orderNotifications),
                    claimNotification: setAllNotificationsTrue(meta.claimNotification),
                    adminNotification: setAllNotificationsTrue(meta.adminNotification),
                    servicerNotification: setAllNotificationsTrue(meta.servicerNotification),
                    dealerNotifications: setAllNotificationsTrue(meta.dealerNotifications),
                    resellerNotifications: setAllNotificationsTrue(meta.resellerNotifications),
                    customerNotifications: setAllNotificationsTrue(meta.customerNotifications),
                    registerNotifications: setAllNotificationsTrue(meta.registerNotifications),
                };
            }
            return meta;
        });
    }
    next();
});

// userSchema.pre("findOneAndUpdate", function (next) {
//     if (this.metaData && Array.isArray(this.metaData)) {
//         this.metaData = this.metaData.map((meta) => {
//             if (meta.isPrimary) {
//                 console.log("checking the function ------222222222222222++++++++++++++++++++++", meta)
//                 return {
//                     ...meta,
//                     orderNotifications: setAllNotificationsTrue(meta.orderNotifications),
//                     claimNotification: setAllNotificationsTrue(meta.claimNotification),
//                     adminNotification: setAllNotificationsTrue(meta.adminNotification),
//                     servicerNotification: setAllNotificationsTrue(meta.servicerNotification),
//                     dealerNotifications: setAllNotificationsTrue(meta.dealerNotifications),
//                     resellerNotifications: setAllNotificationsTrue(meta.resellerNotifications),
//                     customerNotifications: setAllNotificationsTrue(meta.customerNotifications),
//                     registerNotifications: setAllNotificationsTrue(meta.registerNotifications),
//                 };
//             }
//             return meta;
//         });
//     }
//     next();
// });

// userSchema.pre("updateOne", function (next) {
//     if (this.metaData && Array.isArray(this.metaData)) {
//         this.metaData = this.metaData.map((meta) => {
//             if (meta.isPrimary) {
//                 console.log("checking the function ------222222222222222++++++++++++++++++++++", meta)
//                 return {
//                     ...meta,
//                     orderNotifications: setAllNotificationsTrue(meta.orderNotifications),
//                     claimNotification: setAllNotificationsTrue(meta.claimNotification),
//                     adminNotification: setAllNotificationsTrue(meta.adminNotification),
//                     servicerNotification: setAllNotificationsTrue(meta.servicerNotification),
//                     dealerNotifications: setAllNotificationsTrue(meta.dealerNotifications),
//                     resellerNotifications: setAllNotificationsTrue(meta.resellerNotifications),
//                     customerNotifications: setAllNotificationsTrue(meta.customerNotifications),
//                     registerNotifications: setAllNotificationsTrue(meta.registerNotifications),
//                 };
//             }
//             return meta;
//         });
//     }
//     next();
// });

userSchema.pre("insertMany", function (next, docs) {
    console.log("Before InsertMany --------Middleware Triggered", docs);

    if (Array.isArray(docs)) {
        docs.forEach((doc) => {
            if (doc.metaData && Array.isArray(doc.metaData)) {
                doc.metaData = doc.metaData.map((meta) => {
                    if (meta.isPrimary) {
                        meta.orderNotifications = {
                            addingNewOrderPending: true,
                            addingNewOrderActive: true,
                            makingOrderPaid: true,
                            updateOrderPending: true,
                            updateOrderActive: true,
                            archivinOrder: true,
                        }
                        meta.claimNotification = {
                            newClaim: true,
                            fileBulkClaim: true,
                            servicerUpdate: true,
                            customerStatusUpdate: true,
                            repairStatusUpdate: true,
                            claimStatusUpdate: true,
                            partsUpdate: true,
                            claimComment: true
                        }
                        meta.adminNotification = {
                            newUserCreated: false,
                            categoryUpdate: false,
                            priceBookUpdate: false,
                            priceBookAdd: false,
                            unassignDealerServicer: false,
                            assignDealerServicer: false,
                            categoryAdded: false
                        }
                        meta.servicerNotifications = {
                            servicerAdded: false,
                            userAdded: false,
                            userUpdate: false,
                            primaryUpdate: false,
                            userDelete: false
                        }
                        meta.dealerNotifications = {
                            dealerAdded: false,
                            userAdded: false,
                            userUpdate: false,
                            primaryChanged: false,
                            userDelete: false,
                            dealerPriceBookUpload: false,
                            dealerPriceBookAdd: false,
                            dealerPriceBookUpdate: false,
                        }
                        meta.resellerNotifications = {
                            resellerAdded: false,
                            userAdd: false,
                            userUpdate: false,
                            primaryChange: false,
                            userDelete: false,
                        }
                        meta.customerNotifications = {
                            customerAdded: false,
                            userAdd: false,
                            userUpdate: false,
                            primaryChange: false,
                            userDelete: false,
                        }
                        meta.registerNotifications = {
                            dealerRegistrationRequest: false,
                            dealerServicerRequest: false,
                            dealerDisapproved: false,
                            servicerDisapproved: false,
                        }
                        console.log("Processing Primary Metadata:", meta);
                        return {
                            ...meta,
                            orderNotifications: setAllNotificationsTrue(meta.orderNotifications),
                            claimNotification: setAllNotificationsTrue(meta.claimNotification),
                            adminNotification: setAllNotificationsTrue(meta.adminNotification),
                            servicerNotification: setAllNotificationsTrue(meta.servicerNotification),
                            dealerNotifications: setAllNotificationsTrue(meta.dealerNotifications),
                            resellerNotifications: setAllNotificationsTrue(meta.resellerNotifications),
                            customerNotifications: setAllNotificationsTrue(meta.customerNotifications),
                            registerNotifications: setAllNotificationsTrue(meta.registerNotifications),
                        };
                    }
                    return meta;
                });
            }
        });
    }
    next();
});


module.exports = connection.userConnection.model("user", userSchema);
