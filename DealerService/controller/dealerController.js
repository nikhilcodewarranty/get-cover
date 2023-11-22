const { Dealer } = require("../model/dealer");
const { DealerPrice } = require("../model/dealerPrice");
exports.getAllDealer = async (req, res) => {
  try {
    const users = await Dealer.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
