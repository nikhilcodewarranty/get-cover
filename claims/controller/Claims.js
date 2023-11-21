
const {Claims}=require('../model/Claims');
exports.getAllClaims = async (req, res) => {
    try {
      const claims = await Claims.find();
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };