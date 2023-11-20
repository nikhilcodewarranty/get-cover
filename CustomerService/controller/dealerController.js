const {Dealer}=require('../model/Dealer');
exports.getAllDealer = async (req, res) => {
    try {
      const users = await Dealer.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };