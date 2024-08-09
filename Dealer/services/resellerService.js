const reseller = require("../model/reseller")
const user = require('../../User/model/users')

module.exports = class resellerService {
      // Create a new reseller
    static async createReseller(data) {
        try {
            let createReseller = await new reseller(data).save();
            return createReseller;
        } catch (err) {
            return `Could not create reseller: ${err}`; 
        }
    }
  // Retrieve resellers based on a query and projection
    static async getResellers(query, projection) {
        try {
            let getResellers = await reseller.find(query, projection)
            return getResellers;
        } catch (err) {
            return `Could not fetch reseller data: ${err}`;
        }
    }
  // Retrieve a single reseller based on a query and projection
    static async getReseller(query, projection) {
        try {
            let getResellers = await reseller.findOne(query, projection)
            return getResellers;
        } catch (err) {
            return `Could not fetch reseller: ${err}`;
        }
    }
  // Retrieve and sort resellers count based on a query
    static async getResellersCount(query) {
        try {
            const allReselers = await reseller.find(query).sort({ 'unique_key': -1 });
            return allReselers.sort((a, b) => b.unique_key - a.unique_key);
        } catch (error) {
            return `Could not fetch resellers count: ${error}`;
        }
    }
  // Retrieve resellers using aggregation
    static async getResellerByAggregate(query) {
        try {
            const singleResellerResponse = await reseller.aggregate(query);
            return singleResellerResponse;
        } catch (error) {
            return `Could not fetch reseller: ${error}`;
        }

    }
  // Update multiple resellers based on a query
    static async updateMeta(query, projection) {
        try {
            let updateMeta = await reseller.updateMany(query, projection);
            return updateMeta
        }
        catch (err) {
            return `Could not update meta data: ${err}`;
        }
    }
  // Update a single reseller based on criteria
    static async updateReseller(criteria, data) {
        try {
            let updateMeta = await reseller.findOneAndUpdate(criteria, data, { new: true });
            return updateMeta
        } catch (err) {
            return `Could not update reseller: ${err}`;
        }
    }
 
}