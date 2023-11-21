
const {Contracts}=require('../model/Contracts');
exports.getAllContracts = async (req, res) => {
    try {
      const contract = await Contracts.find();
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };