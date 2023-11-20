const {PRICES}=require('../model/Price_Book');

exports.getAllPriceBook = async (req, res) => {
    try {
      const users = await PRICES.find();
      res.json(users); 
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };