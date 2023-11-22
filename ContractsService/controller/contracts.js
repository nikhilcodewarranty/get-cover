
const {Contracts}=require('../model/contracts');
const contractResourceResponse = require('../utils/constant');
exports.getAllContracts = async (req, res) => {
    try {
      const contract = await Contracts.find();
      res.json(contract);
    } catch(error) {
      res.status(contractResourceResponse.serverError.statusCode).json({ error: 'Internal server error' });
    }
  };