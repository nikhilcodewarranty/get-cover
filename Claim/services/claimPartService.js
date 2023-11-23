const claimPart = require("../model/claimPart");

module.exports = class claimPartService {
  static async getAllClaimParts() {
    try {
      const allClaimParts = await claimPart.find();
      return allClaimParts;
    } catch (error) { 
      console.log(`Could not fetch claim part ${error}`);
    }
  }

  static async createClaimPart(data) {
    try {
      const response = await new claimPart(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getClaimPartById(claimPartId) {
    try {
      const singleClaimPartResponse = await claimPart.findById({ _id: claimPartId });
      return singleClaimPartResponse;
    } catch (error) {
      console.log(`Claim part not found. ${error}`);
    }
  }

  static async updateClaimPart(data) {
    try {
      const updatedResponse = await claimPart.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update claim part ${error}`);
    }
  }

  static async deleteClaimPart(claimPartId) {
    try {
      const deletedResponse = await claimPart.findOneAndDelete(claimId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete claim part ${error}`);
    }
  }
};

