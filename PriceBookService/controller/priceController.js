const {PRICES}=require('../model/Price_Book');
const priceResourceResponse = require('../utils/constant');

exports.getAllPriceBook = async (req, res) => {
    try {
      const users = await PRICES.find();
      res.json(users); 
    } catch (error) {
      res.status(priceResourceResponse.serverError.statusCode).json({ error: 'Internal server error' });
    }
  };