const contracts = require("../model/contracts");

module.exports = class contractService {
  static async getAllContracts() {
    try {
      const allContracts = await contracts.find();
      return allContracts;
    } catch (error) {
      console.log(`Could not fetch contracts ${error}`);
    }
  }

  static async createContracts(data) {
    try {
      const response = await new contracts(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getContractById(contractId) {
    try {
      const singleContractResponse = await contracts.findById({
        _id: contractId,
      });
      return singleContractResponse;
    } catch (error) {
      console.log(`Contract not found. ${error}`);
    }
  }

  static async updateContract(data) {
    try {
      const updateResponse = await contracts.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update contract ${error}`);
    }
  }

  static async deleteContract(contractId) {
    try {
      const deletedResponse = await contracts.findOneAndDelete(contractId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }
};
