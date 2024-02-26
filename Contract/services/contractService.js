const contract = require("../model/contract");

module.exports = class contractService {
  static async getAllContracts(query,pageLimit,page) {
    try {
      const allContracts = await contract.aggregate(query).sort({createdAt:-1}).skip(pageLimit).limit(page);
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
      const count = await contract.find();
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);;
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async findContracts(query) {
    try {
      console.log("find query+++++++++++",query)
      const count = await contract.find(query).sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async findContractCount(query) {
    try {
      console.log("find query+++++++++++",query)
      const count = await contract.find(query).countDocuments();
      return count
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
      const singleContractResponse = await contract.findOne(contractId);
      return singleContractResponse;
    } catch (error) {
      console.log(`Contract not found. ${error}`);
    }
  }

  static async updateContract(criteria,data,option) {
    try {
      const updatedResponse = await contract.findOneAndUpdate(criteria,data,option);

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

  static async getContractForPDF(query){
    try {
      const getResponse = await contract.aggregate(query);
      return getResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }
};
