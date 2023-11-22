
const {Claims}=require('../model/claims');
const {ClaimsPart}=require('../model/claimsPart');
const {ClaimsStatus}=require('../model/claimsStatus');
const claimResourceResponse = require('../utils/constant');
exports.getAllClaims = async (req, res) => {
    try {
      const claims = await Claims.find();
      res.json(claims);
    } catch (error) {
      res.status(claimResourceResponse.serverError.statusCode).json({ error: 'Internal server error' });
    }
  };