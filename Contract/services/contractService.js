const contract = require("../model/contract");

module.exports = class contractService {
  static async getAllContracts(query) {
    try {
      console.log("service get contraCT----------------",query)
      const allContracts = await contract.aggregate(query);
      console.log("service get contraCT----------------",allContracts)
      return allContracts;
    } catch (error) {
      console.log(`Could not fetch contracts ${error}`);
    }
  }

  static async createContract(data) {
    try {
      const response = await new contract(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getContractsCount() {
    try {
      const count = await contract.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async createBulkContracts(data) {
    try {
      console.log('service inset mny',data)
      const bulkContract = await contract.insertMany(data);
      console.log('service inset mny',data,bulkContract)
      return bulkContract;
    }
    catch(error){
      console.log(`Contract not found ${error}`)
    }
  }

  static async getContractById(contractId) {
    try {
      const singleContractResponse = await contract.findById({
        _id: contractId,
      });
      return singleContractResponse;
    } catch (error) {
      console.log(`Contract not found. ${error}`);
    }
  }

  static async updateContract(data) {
    try {
      const updatedResponse = await contract.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update contract ${error}`);
    }
  }

  static async deleteContract(contractId) {
    try {
      const deletedResponse = await contract.findOneAndDelete(contractId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }

  static async getContracts(query,pageLimit,page){
    try {
      const getResponse = await contract.aggregate(query,pageLimit,page).skip(pageLimit).limit(page);
      return getResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }
};
