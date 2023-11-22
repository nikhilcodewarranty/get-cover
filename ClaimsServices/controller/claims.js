
const {Claims}=require('../model/claims');
const {ClaimsPart}=require('../model/claimsPart');
const {ClaimsStatus}=require('../model/claimsStatus');
exports.getAllClaims = async (req, res) => {
    try {
      const claims = await Claims.find();
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };