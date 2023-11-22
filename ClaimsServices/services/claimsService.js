const claims = require("../model/claims");

module.exports = class claimService {
  static async getAllClaims() {
    try {
      const allClaims = await claims.find();
      return allClaims;
    } catch (error) {
      console.log(`Could not fetch claims ${error}`);
    }
  }

  static async createClaims(data) {
    try {
      const response = await new claims(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getClaimbyId(claimId) {
    try {
      const singleClaimResponse = await claims.findById({ _id: claimId });
      return singleClaimResponse;
    } catch (error) {
      console.log(`claim not found. ${error}`);
    }
  }

  static async updateClaim(title, body, articleImage) {
    try {
      const updateResponse = await claims.updateOne(
        { title, body, articleImage },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update claim ${error}`);
    }
  }

  static async deleteClaim(claimId) {
    try {
      const deletedResponse = await claims.findOneAndDelete(claimId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete claim ${error}`);
    }
  }
};
