const contract = require("../model/contract");

module.exports = class contractService {
  // Fetch all contracts based on a query with pagination
  static async getAllContracts(query, pageLimit, page) {
    try {
      const allContracts = await contract.aggregate(query, { allowDiskUse: true }).skip(pageLimit).limit(page);
      return allContracts;
    } catch (error) {
      return `Could not fetch contracts ${error}`
    }
  }

  // Fetch all contracts based on a query without pagination
  static async getAllContracts2(query, pageLimit, page) {
    try {
      const allContracts = await contract.aggregate(query)
      return allContracts;
    } catch (error) {
      return `Could not fetch contracts ${error}`
    }
  }

  // Create a new contract
  static async createContract(data) {
    try {
      const response = await new contract(data).save();
      return response;
    } catch (error) {
      return `Could not create contract: ${error}`;
    }
  }

  static async getContractsCount() {
    try {
      const count = await contract.find();
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);;
    } catch (error) {
      return`Could not fetch contract count ${error}`;
    }
  }
  // Find contracts based on a query with pagination and sorting by createdAt
  static async findContracts2(query, limit, page) {
    try {
      const contracts = await contract.find(query).sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit).lean()
        .exec();
      return contracts
    } catch (error) {
      return `Could not fetch contracts: ${error}`;
    }
  }

  // Get the latest contract based on unique_key_number
  static async getContractsCountNew() {
    try {
      const count = await contract.find().sort({ unique_key_number: -1 }).limit(1);
      return count;
    } catch (error) {
      return `Could not fetch contract count: ${error}`;
    }
  }

  // Find contracts based on a query sorted by unique_key
  static async findContracts(query) {
    try {
      const count = await contract.find(query).sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      return `Could not fetch contracts: ${error}`;
    }
  }

  // Get the count of contracts based on a query
  static async findContractCount(query) {
    try {
      const count = await contract.find(query).countDocuments();
      return count
    } catch (error) {
      return `Could not fetch contract count: ${error}`;
    }
  }

  // Create multiple contracts in bulk
  static async createBulkContracts(data) {
    try {
      let bulkContract = await contract.insertMany(data);
      return bulkContract;
    }
    catch (error) {
      return `Could not create bulk contracts: ${error}`;
    }
  }

  // Fetch a contract by its ID with optional projection
  static async getContractById(contractId, projection = {}) {
    try {
      const singleContractResponse = await contract.findOne(contractId, projection);
      return singleContractResponse;
    } catch (error) {
      return `Could not contract not found: ${error}`;
    }
  }

  // Update a contract based on criteria with provided data and options
  static async updateContract(criteria, data, option) {
    try {
      const updatedResponse = await contract.findOneAndUpdate(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      return `Could not update contract: ${error}`;
    }
  }

  // Delete a contract by its ID
  static async deleteContract(contractId) {
    try {
      const deletedResponse = await contract.findOneAndDelete(contractId);
      return deletedResponse;
    } catch (error) {
      return `Could not delete contract: ${error}`;
    }
  }

  // Fetch contracts based on a query with pagination
  static async getContracts(query, pageLimit, page) {
    try {
      const getResponse = await contract.aggregate(query, pageLimit, page).skip(pageLimit).limit(page);
      return getResponse;
    } catch (error) {
      return `Could not fetch contracts: ${error}`;
    }
  }

  // Fetch contract data for generating PDFs based on a query
  static async getContractForPDF(query) {
    try {
      const getResponse = await contract.aggregate(query);
      return getResponse;
    } catch (error) {
      return `Could not fetch contract for PDF: ${error}`;
    }
  }
  // Perform bulk update operations on contracts based on a query
  static async allUpdate(query) {
    try {
      const getResponse = await contract.bulkWrite(query);
      return getResponse;
    } catch (error) {
      return `Could not update contracts: ${error}`;
    }
  }

};