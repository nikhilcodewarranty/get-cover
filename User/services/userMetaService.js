const user = require("../model/userMeta");
const role = require("../model/role");
const { userConnection } = require("../../db");

//-------------------------- user's services ------------------------------//

module.exports = class userService {

    // get meta dealer/customer/servicers/resellers
    static async findMeta(query, projection) {
        try {
            projection = projection ? projection : {}
            const user = await user.findOne(query, projection);
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

    // get all meta 
    static async findMetaList(query, projection) {
        try {
            projection = projection ? projection : {}
            const user = await user.find(query, projection).sort({ createdAt: -1 });
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

    //create meta api
    static async createMeta(data) {
        try {
            const user = await user(data).save();
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

    //create meta api
    static async createBulkMeta(data) {
        try {
            const user = await user.insertMany(data);
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

    //Get 
    static async aggregateMeta(query) {
        try {
            const user = await user.aggregate(query).sort({ "createdAt": -1 });
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

    static async updateMeta(criteria, data, option) {
        try {
            const user = await user.findOneAndUpdate(criteria, data, option);
            return user;
        } catch (error) {
            console.log(`Could not fetch users ${error}`);
        }
    }

};
