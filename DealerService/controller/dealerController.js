const {Dealer}=require('../model/Dealer');
const {Dealer_Price}=require('../model/Dealer_Price');
exports.getAllDealer = async (req, res) => {
    try {
      const users = await Dealer.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };