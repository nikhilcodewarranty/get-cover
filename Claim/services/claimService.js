const claim = require("../model/claim");

module.exports = class claimService {
  static async getAllClaims(query) {
    try {
      const allClaims = await claim.aggregate(query);
      return allClaims;
    } catch (error) { 
      console.log(`Could not fetch claims ${error}`);
    }
  }

  static async createClaim(data) {
    try {
      const response = await new claim(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getClaimById(claimId) {
    try {
      const singleClaimResponse = await claim.findById({ _id: claimId });
      return singleClaimResponse;
    } catch (error) {
      console.log(`claim not found. ${error}`);
    }
  }

  static async updateClaim(title, body, articleImage) {
    try {
      const updatedResponse = await claim.updateOne(
        { title, body, articleImage },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update claim ${error}`);
    }
  }

  static async deleteClaim(claimId) {
    try {
      const deletedResponse = await claim.findOneAndDelete(claimId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete claim ${error}`);
    }
  }
};
