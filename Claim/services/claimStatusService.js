const claimStatus = require("../model/claimStatus");

module.exports = class claimStatusService {
  static async getAllClaimsStatus() {
    try {
      const allClaimsStatus = await claimStatus.find();
      return allClaimsStatus;
    } catch (error) { 
      console.log(`Could not fetch claims status ${error}`);
    }
  }

  static async createClaimsStatus(data) {
    try {
      const response = await new claimStatus(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getClaimPartById(claimPartId) {
    try {
      const singleClaimPartResponse = await claimStatus.findById({ _id: claimPartId });
      return singleClaimPartResponse;
    } catch (error) {
      console.log(`claim part not found. ${error}`);
    }
  }

  static async updateClaimPart(data) {
    try {
      const updateResponse = await claimStatus.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update claim part ${error}`);
    }
  }

  static async deleteClaimPart(claimPartId) {
    try {
      const deletedResponse = await claimStatus.findOneAndDelete(claimId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete claim part ${error}`);
    }
  }
};

