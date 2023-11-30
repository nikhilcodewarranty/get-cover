require("dotenv").config();
const mongoose = require('mongoose')
let mongouri = process.env.DB_URL + 'User'
console.log('url check-',mongouri)
exports.databaseConnect = async (mongouri) => {
  console.log(mongouri)
  try {
    await mongoose.connect(mongouri);
    console.log("database connection connected");
  } catch (error) {
    console.log(
      "🚀 ~ file: mongoDb.js:8 ~ exports.databaseConnect= ~ error:",
      error
    );
  }
};
