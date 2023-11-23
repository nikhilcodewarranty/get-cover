const mongoose = require("mongoose");

exports.databaseConnect = async (mongouri) => {
  console.log(mongouri);
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
