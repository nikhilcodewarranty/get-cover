
const {Claims}=require('../model/Claims');
const {Claimes_Part}=require('../model/Claimes_Part');
const {Claims_Status}=require('../model/Claims_Status');
exports.getAllClaims = async (req, res) => {
    try {
      const claims = await Claims.find();
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };