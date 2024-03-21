const claim = require("../model/claim");
const comments = require("../model/comments");

module.exports = class claimService {
  static async getAllClaims(query) {
    try {
      const allClaims = await claim.aggregate(query);
      return allClaims;
    } catch (error) {
      console.log(`Could not fetch claims ${error}`);
    }
  }
  static async getAllMessages(query) {
    try {
      const allMessages = await comments.aggregate(query);
      return allMessages;
    } catch (error) {
      console.log(`Could not fetch claims ${error}`);
    }
  }
  static async getClaims(query) {
    try {
      const allClaims = await claim.find(query);
      return allClaims;
    } catch (error) {
      console.log(`Could not fetch claims ${error}`);
    }
  }
  static async getClaimCount() {
    try {
      const count = await claim.find({}, { unique_key_number: 1 }).sort({ unique_key_number: -1 });
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);;
    } catch (error) {
      console.log(`Could not fetch order count ${error}`);
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
  static async addMessage(data) {
    try {
      const response = await new comments(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async checkTotalAmount(query) {
    try {
      const response = await claim.aggregate([
        { $match: query },
        { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

      ])
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getClaimById(claimId, projection = {}) {
    try {
      const singleClaimResponse = await claim.findOne(claimId, projection);
      return singleClaimResponse;
    } catch (error) {
      console.log(`claim not found. ${error}`);
    }
  }
  static async updateClaim(criteria, data, option) {
    try {
      let updatedResponse = await claim.findOneAndUpdate(criteria, data, option)
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
  static async saveBulkClaim(data) {
    try {
      const bulkResponse = await claim.insertMany(data);
      return bulkResponse;
    } catch (error) {
      console.log(`Could  not delete claim ${error}`);
    }
  }
  static async getDashboardData(query, project = {}) {
    try {
      const allOrders = await claim.aggregate([
        {
          $match: query
        },
        {
          "$group": {
            "_id": "",
            "totalAmount": {
              "$sum": {
                "$sum": "$totalAmount"
              }
            },
          },

        },


      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }
};
