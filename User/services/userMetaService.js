const user = require("../model/userMeta");
const role = require("../model/role");
const { userConnection } = require("../../db");
module.exports = class userService {

    // Get a single user meta based on a query and projection
    static async findMeta(query, projection) {
        try {
            projection = projection ? projection : {}
            const userMeta = await user.findOne(query, projection);
            return userMeta;
        } catch (error) {
            return `Could not fetch user meta: ${error}`;
        }
    }

    // Get a list of user metas based on a query and projection
    static async findMetaList(query, projection) {
        try {
            projection = projection ? projection : {}
            const userMetaList = await user.find(query, projection).sort({ createdAt: -1 });
            return userMetaList;
        } catch (error) {
            return `Could not fetch user meta list: ${error}`;
        }
    }

    // Create a new user meta
    static async createMeta(data) {
        try {
            const newUserMeta = await user(data).save();
            return newUserMeta;
        } catch (error) {
            return `Could not create user meta: ${error}`;
        }
    }

    // Create multiple user metas in bulk
    static async createBulkMeta(data) {
        try {
            const bulkUserMeta = await user.insertMany(data);
            return bulkUserMeta;
        } catch (error) {
            return `Could not create user meta in bulk: ${error}`;
        }
    }

    // Get aggregated user meta data based on a query
    static async aggregateMeta(query) {
        try {
            const aggregatedUserMeta = await user.aggregate(query).sort({ "createdAt": -1 });
            return aggregatedUserMeta;
        } catch (error) {
            return `Could not fetch aggregated user meta: ${error}`;
        }
    }

    // Update a user meta based on criteria and new data
    static async updateMeta(criteria, data, option) {
        try {
            const updatedUserMeta = await user.findOneAndUpdate(criteria, data, option);
            return updatedUserMeta;
        } catch (error) {
            return `Could not update user meta: ${error}`;
        }
    }

};
