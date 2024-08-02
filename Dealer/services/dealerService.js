const dealer = require("../model/dealer");
const dealerPrice = require("../model/dealerPrice");
const users = require("../../User/model/users");
const { $_match } = require("../validators/register_dealer");

module.exports = class dealerService {
  // Get all dealers
  static async getAllDealers(query, projection) {
    try {
      const AllDealers = await dealer.find(query, projection).sort({ "unique_key": 1 });
      return AllDealers.sort((a, b) => b.unique_key - a.unique_key);
    } catch (error) {
      return `Could not fetch dealers: ${error}`;
    }
  }

  // Get dealer and claims
  static async getDealerAndClaims(query) {
    try {
      const singleResellerResponse = await dealer.aggregate(query);
      return singleResellerResponse;
    } catch (error) {
      return `Customer not found: ${error}`;
    }
  }

  // Get all dealers with name matching
  static async getAllDealers1(data) {
    try {
      const AllDealers = await dealer.aggregate([
        {
          $match: {
            'name': { $regex: /data.name/i }
          }
        }
      ]);
      return AllDealers;
    } catch (error) {
      return `Could not fetch dealers: ${error}`;
    }
  }

  // Get top five dealers
  static async getTopFiveDealers(query) {
    try {
      const topDealers = await dealer.aggregate(query);
      return topDealers;
    } catch (error) {
      return `Dealer not found: ${error}`;
    }
  }

  // Get dealer count
  static async getDealerCount() {
    try {
      const count = await dealer.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);
    } catch (error) {
      return `Could not fetch price book: ${error}`;
    }
  }

  // Create new dealer
  static async createDealer(data) {
    try {
      const response = await new dealer(data).save();
      return response;
    } catch (error) {
      return error;
    }
  }

  // Get dealer detail with ID
  static async getDealerById(dealerId, projection) {
    try {
      const singleDealerResponse = await dealer.findOne({ _id: dealerId }, projection);
      return singleDealerResponse;
    } catch (error) {
      return `Dealer not found: ${error}`;
    }
  }

  // Get single dealer by ID
  static async getSingleDealerById(dealerId, projection) {
    try {
      const singleDealerResponse = await dealer.find(dealerId, projection);
      return singleDealerResponse;
    } catch (error) {
      return `Dealer not found: ${error}`;
    }
  }

  // Get user by dealer ID
  static async getUserByDealerId(query) {
    try {
      const singleDealerResponse = await users.find(query).sort({ isPrimary: -1, createdAt: -1 });
      return singleDealerResponse;
    } catch (error) {
      return `Dealer not found: ${error}`;
    }
  }

  // Get dealer detail with Name
  static async getDealerByName(query, projection) {
    try {
      const singleDealerResponse = await dealer.findOne(query, projection);
      return singleDealerResponse;
    } catch (error) {
      return `Dealer not found: ${error}`;
    }
  }

  // Update dealer detail with ID
  static async updateDealer(criteria, newValue, option) {
    try {
      const updatedResponse = await dealer.findOneAndUpdate(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update dealer: ${error}`;
    }
  }

  // Update dealer status
  static async updateDealerStatus(criteria, newValue, option) {
    try {
      const updatedResponse = await dealer.findOneAndUpdate(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update dealer: ${error}`;
    }
  }

  // Delete dealer by ID
  static async deleteDealer(criteria) {
    try {
      const deletedResponse = await dealer.deleteOne(criteria);
      return deletedResponse;
    } catch (error) {
      return `Could not delete dealer: ${error}`;
    }
  }

  // Create price book
  static async createPriceBook(data) {
    try {
      const response = await new dealerPrice(data).save();
      return response;
    } catch (error) {
      return error;
    }
  }


  // Register dealer
  static async registerDealer(data) {
    try {
      const response = await new dealer(data).save();
      return response;
    } catch (error) {
      return error;
    }
  }

  // Status update
  static async statusUpdate(criteria, newValue, option) {
    try {
      const updatedResult = await dealerPrice.findByIdAndUpdate(criteria, newValue, option);
      return updatedResult;
    } catch (error) {
      return error;
    }
  }

  // Approve or disapprove dealer
  static async isApprovedOrDisapproved(criteria, newValue, option) {
    try {
      const updatedResult = await dealer.findByIdAndUpdate(criteria, newValue, option);
      return updatedResult;
    } catch (error) {
      return error;
    }
  }
};
