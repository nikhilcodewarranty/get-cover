const mongoose = require("mongoose");
const connection = require('../../db');

// Define the default resetColor array


const settingSchema = new mongoose.Schema({
  logoLight: {
    type: {},
    default: {}
  },
  logoDark: {
    type: {},
    default: {}
  },
  favIcon: {
    type: {},
    default: {}
  },
  title: {
    type: String,
    default: ''
  },
  colorScheme: {
    type: [
      {
        colorCode: {
          type: String,
          default: ''
        },
        colorType: {
          type: String,
          default: ''
        }
      }
    ]
  },
  address: {
    type: String,
    default: ''
  },
  paymentDetail: {
    type: String,
    default: ''
  },
  defaultColor: {
    type: [
      {
        colorCode: {
          type: String,
          default: ''
        },
        colorType: {
          type: String,
          default: ''
        }
      }
    ],
    default: [] // Set the default value
  },
  defaultLightLogo:{
    type: {},
    default: {}
  },
  defaultDarkLogo:{
    type: {},
    default: {}
  },
  defaultFavIcon:{
    type: {},
    default: {}
  },
  defaultTitle:{
    type: String,
    default: ''
  },
  defaultPaymentDetail:{
    type: String,
    default: ''
  },
  defaultAddress:{
    type: String,
    default: ''
  },
  setDefault: {
    type: Number,
    default:0
  },
  // userId:{
  //   type: mongoose.Schema.Types.ObjectId,
  //   default:null
  // }
});

module.exports = connection.userConnection.model("setting", settingSchema);
