const claim = require("../model/claim");
const comments = require("../model/comments");

module.exports = class claimService {

  // Fetch all messages based on a query
  static async getAllMessages(query) {
    try {
      const allMessages = await comments.aggregate(query);
      return allMessages;
    } catch (error) {
      return `Could not fetch messages: ${error}`;
    }
  }

  // Fetch claims based on a query
  static async getClaims(query) {
    try {
      const allClaims = await claim.find(query);
      return allClaims;
    } catch (error) {
      return `Could not fetch claims: ${error}`;
    }
  }

  // Fetch the last number of claims based on a query, sorted by unique_key_number
  static async getLastNumberOfClaims(query) {
    try {
      const getLastNumberOfClaims = await claim.find(query).sort({ unique_key_number: -1 }).limit(5);
      return getLastNumberOfClaims;
    } catch (error) {
      return `Could not fetch claims: ${error}`;
    }
  }

  // Get the count of claims, sorted by unique_key_number
  static async getClaimCount() {
    try {
      const count = await claim.find({}, { unique_key_number: 1 }).sort({ unique_key_number: -1 });
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);
    } catch (error) {
      return `Could not fetch claim count: ${error}`;
    }
  }

  // Create a new claim
  static async createClaim(data) {
    try {
      const response = await new claim(data).save();
      return response;
    } catch (error) {
      return `Could not create claim: ${error}`;
    }
  }

  // Add a new message
  static async addMessage(data) {
    try {
      const response = await new comments(data).save();
      return response;
    } catch (error) {
      return `Could not add message: ${error}`;
    }
  }

  // Fetch a claim by its ID, with optional projection
  static async getClaimById(claimId, projection = {}) {
    try {
      const singleClaimResponse = await claim.findOne(claimId, projection);
      return singleClaimResponse;
    } catch (error) {
      return `Claim not found: ${error}`;
    }
  }

  // Update a claim based on criteria with provided data and options
  static async updateClaim(criteria, data, option) {
    try {
      let updatedResponse = await claim.findOneAndUpdate(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update claim: ${error}`;
    }
  }

  // Delete a claim by its ID
  static async deleteClaim(claimId) {
    try {
      const deletedResponse = await claim.findOneAndDelete(claimId);
      return deletedResponse;
    } catch (error) {
      return `Could not delete claim: ${error}`;
    }
  }

  // Save multiple claims in bulk
  static async saveBulkClaim(data) {
    try {
      const bulkResponse = await claim.insertMany(data);
      return bulkResponse;
    } catch (error) {
      return `Could not save bulk claims: ${error}`;
    }
  }

  // Mark claims as paid based on criteria, data, and options
  static async markAsPaid(criteria, data, option) {
    try {
      const paidBulk = await claim.updateMany(criteria, data, option);
      return paidBulk;
    } catch (error) {
      return `Could not mark claims as paid: ${error}`;
    }
  }

  // Aggregate claims based on a query with optional projection
  static async getClaimWithAggregate(query, project = {}) {
    try {
      const allOrders = await claim.aggregate(query);
      return allOrders;
    } catch (error) {
      return `Could not fetch claims: ${error}`;
    }
  }

  // not using
  static async getAllClaims(query) {
    try {
      const allClaims = await claim.aggregate(query);
      return allClaims;
    } catch (error) {
      return `Could not fetch claims: ${error}`;
    }
  }

  // Check the total amount of claims based on a query
  static async checkTotalAmount(query) {
    try {
      const response = await claim.aggregate([
        { $match: query },
        { $group: { _id: null, amount: { $sum: "$totalAmount" } } }
      ]);
      return response;
    } catch (error) {
      return `Could not check total amount: ${error}`;
    }
  }

  // Get the total value of claims for servicers based on a query and groupBy criteria
  static async getServicerClaimsValue(query, groupBy = {}) {
    try {
      const allOrders = await claim.aggregate([
        { $match: query },
        {
          "$group": {
            "_id": groupBy,
            "totalAmount": { "$sum": { "$sum": "$totalAmount" } },
          }
        }
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch servicer claims value: ${error}`;
    }
  }

  // Get the number of claims for servicers based on a query and groupBy criteria
  static async getServicerClaimsNumber(query, groupBy = {}) {
    try {
      const allOrders = await claim.aggregate([
        { $match: query },
        { $group: { _id: groupBy, noOfOrders: { $sum: 1 } } }
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch servicer claims number: ${error}`;
    }
  }

  // Get dashboard data based on a query and groupBy criteria
  static async getDashboardData(query, groupBy = {}) {
    try {
      const allOrders = await claim.aggregate([
        { $match: query },
        {
          "$group": {
            "_id": "",
            "totalAmount": { "$sum": { "$sum": "$totalAmount" } }
          }
        }
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch dashboard data: ${error}`;
    }
  }

  // Get the value of completed claims based on a query
  static async valueCompletedClaims(query, project = {}) {
    try {
      const allOrders = await claim.aggregate(query);
      return allOrders;
    } catch (error) {
      return `Could not fetch completed claims value: ${error}`;
    }
  }

};
