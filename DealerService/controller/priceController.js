const { Prices } = require("../model/priceBook");

exports.getAllPriceBook = async (req, res) => {
  try {
    const users = await Prices.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
