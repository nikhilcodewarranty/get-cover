const mongoose = require("mongoose");
const connection = require('../../db');

// Define the default resetColor array
const defaultResetColor = [
  {
    colorCode: "#303030",
    colorType: "sideBarColor"
  },
  {
    colorCode: "#fafafa",
    colorType: "sideBarTextColor"
  },
  {
    colorCode: "#f2f2f2",
    colorType: "sideBarButtonColor"
  },
  {
    colorCode: "#201d1d",
    colorType: "sideBarButtonTextColor"
  },
  {
    colorCode: "#343232",
    colorType: "buttonColor"
  },
  {
    colorCode: "#fffafa",
    colorType: "buttonTextColor"
  },
  {
    colorCode: "#f2f2f2",
    colorType: "backGroundColor"
  },
  {
    colorCode: "",
    colorType: "textColor"
  },
  {
    colorCode: "#242424",
    colorType: "titleColor"
  },
  {
    colorCode: "#1a1a1a",
    colorType: "cardColor"
  },
  {
    colorCode: "#fcfcfc",
    colorType: "cardBackGroundColor"
  },
  {
    colorCode: "#fcfcfc",
    colorType: "modelBackgroundColor"
  },
  {
    colorCode: "#2b2727",
    colorType: "modelColor"
  }
];

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
  resetColor: {
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
    default: defaultResetColor // Set the default value
  }
});

module.exports = connection.userConnection.model("setting", settingSchema);
