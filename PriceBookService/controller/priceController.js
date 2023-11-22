const { Prices } = require("../model/priceBook");
const priceResourceResponse = require("../utils/constant");

exports.getAllPriceBook = async (req, res) => {
  try {
    const users = await Prices.find();
    res.json(users);
  } catch (error) {
    res
      .status(priceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
