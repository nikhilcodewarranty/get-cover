const {Dealer}=require('../model/Dealer');
const {Dealer_Price}=require('../model/Dealer_Price');
const dealerResourceResponse = require('../utils/constant');
exports.getAllDealer = async (req, res) => {
    try {
      const dealer = await Dealer.find();
      res.json(dealer);
    } catch (error) {
      res.status(dealerResourceResponse.serverError.statusCode).json({ error: 'Internal server error' });
    }
  };