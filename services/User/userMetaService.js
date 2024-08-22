const user = require("../../models/User/userMeta");
const role = require("../../models/User/role");
const { userConnection } = require("../../db");

//-------------------------- user's services ------------------------------//

module.exports = class userService {

    // get meta dealer/customer/servicers/resellers
    static async findMeta(query, projection) {
        try {
            projection = projection ? projection : {}
            const user = await user.findOne(query, projection);
            return user;
        }  catch (error) {
            return `Could not fetch user meta: ${error}`;
        }
    }

    // get all meta 
    static async findMetaList(query, projection) {
        try {
            projection = projection ? projection : {}
            const user = await user.find(query, projection).sort({ createdAt: -1 });
            return user;
        } catch (error) {
            return `Could not fetch user meta list: ${error}`;
        }
    }

    //create meta api
    static async createMeta(data) {
        try {
            const user = await user(data).save();
            return user;
        } catch (error) {
            return `Could not create user meta: ${error}`;
        }
    }

    //create meta api
    static async createBulkMeta(data) {
        try {
            const user = await user.insertMany(data);
            return user;
        } catch (error) {
            return `Could not create user meta in bulk: ${error}`;
        }
    }

    //aggreaget meta api
    static async aggregateMeta(query) {
        try {
            const user = await user.aggregate(query).sort({ "createdAt": -1 });
            return user;
        } catch (error) {
            return `Could not fetch aggregated user meta: ${error}`;
        }
    }

    static async updateMeta(criteria, data, option) {
        try {
            const user = await user.findOneAndUpdate(criteria, data, option);
            return user;
        } catch (error) {
            return `Could not update user meta: ${error}`;
        }
    }

};