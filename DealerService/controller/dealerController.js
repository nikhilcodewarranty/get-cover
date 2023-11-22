const { Dealer } = require("../model/dealer");
const { DealerPrice } = require("../model/dealerPrice");
const dealerResourceResponse = require("../utils/constant");

exports.getAllDealer = async (req, res) => {
  try {
    const dealer = await Dealer.find();
    res.json(dealer);
  } catch (error) {
    res
      .status(dealerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
