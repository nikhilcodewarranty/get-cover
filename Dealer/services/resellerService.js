const reseller = require("../model/reseller");
const user = require('../../User/model/users');

module.exports = class resellerService {

  // Create a new reseller
  static async createReseller(data) {
    try {
      const createdReseller = await new reseller(data).save();
      return createdReseller;
    } catch (err) {
      return `Could not create reseller: ${err}`;
    }
  }

  // Retrieve resellers based on a query and projection
  static async getResellers(query, projection) {
    try {
      const resellers = await reseller.find(query, projection);
      return resellers;
    } catch (err) {
      return `Could not fetch reseller data: ${err}`;
    }
  }

  // Retrieve a single reseller based on a query and projection
  static async getReseller(query, projection) {
    try {
      const reseller = await reseller.findOne(query, projection);
      return reseller;
    } catch (err) {
      return `Could not fetch reseller: ${err}`;
    }
  }

  // Retrieve and sort resellers count based on a query
  static async getResellersCount(query) {
    try {
      const allResellers = await reseller.find(query).sort({ 'unique_key': -1 });
      return allResellers.sort((a, b) => b.unique_key - a.unique_key);
    } catch (error) {
      return `Could not fetch resellers count: ${error}`;
    }
  }

  // Retrieve resellers using aggregation
  static async getResellerByAggregate(query) {
    try {
      const resellerResponse = await reseller.aggregate(query);
      return resellerResponse;
    } catch (error) {
      return `Could not fetch reseller: ${error}`;
    }
  }

  // Update multiple resellers based on a query
  static async updateMeta(query, projection) {
    try {
      const updateResponse = await reseller.updateMany(query, projection);
      return updateResponse;
    } catch (err) {
      return `Could not update meta data: ${err}`;
    }
  }

  // Update a single reseller based on criteria
  static async updateReseller(criteria, data) {
    try {
      const updatedReseller = await reseller.findOneAndUpdate(criteria, data, { new: true });
      return updatedReseller;
    } catch (err) {
      return `Could not update reseller: ${err}`;
    }
  }

};
