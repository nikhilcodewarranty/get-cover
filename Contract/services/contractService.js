const contract = require("../model/contract");

module.exports = class contractService {
  static async getAllContracts(query, pageLimit, page) {
    try {
      const allContracts = await contract.aggregate(query, { allowDiskUse: true }).skip(pageLimit).limit(page);
      return allContracts;
    } catch (error) {
      console.log(`Could not fetch contracts ${error}`);
    }
  }

  static async getAllContracts2(query, pageLimit, page) {
    try {
      const allContracts = await contract.aggregate(query)
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

  static async findContracts1(query) {
    try {
      const contracts = await contract.find(query, {})
      return contracts
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async findContracts2(query, limit, page) {
    try {
      const contracts = await contract.find(query).sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit).lean()
        .exec();
      return contracts
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async getContractsCountNew() {
    try {
      const count = await contract.find().sort({ unique_key_number: -1 }).limit(1);
      return count;
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async findContracts(query) {
    try {
      const count = await contract.find(query).sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async findContractCount(query) {
    try {
      const count = await contract.find(query).countDocuments();
      return count
    } catch (error) {
      console.log(`Could not fetch contract count ${error}`);
    }
  }

  static async createBulkContracts(data) {
    try {
      let bulkContract = await contract.insertMany(data);
      return bulkContract;
    }
    catch (error) {
      console.log(`Contract not found ${error}`)
    }
  }

  static async getContractById(contractId, projection = {}) {
    try {
      const singleContractResponse = await contract.findOne(contractId, projection);
      return singleContractResponse;
    } catch (error) {
      console.log(`Contract not found. ${error}`);
    }
  }

  static async updateContract(criteria, data, option) {
    try {
      const updatedResponse = await contract.findOneAndUpdate(criteria, data, option);

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

  static async getContracts(query, pageLimit, page) {
    try {
      const getResponse = await contract.aggregate(query, pageLimit, page).skip(pageLimit).limit(page);
      return getResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }

  static async getContractForPDF(query) {
    try {
      const getResponse = await contract.aggregate(query);
      return getResponse;
    } catch (error) {
      console.log(`Could  not delete contract ${error}`);
    }
  }

  static async allUpdate(query) {
    try {
      const getResponse = await contract.bulkWrite(query);
      return getResponse;
    } catch (error) {
      console.log(`Could  not update contract ${error}`);
    }
  }

};
