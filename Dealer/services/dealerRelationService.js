const dealer = require("../model/dealer");
const servier = require('../../Provider/model/serviceProvider')
const relationTable = require('../../Provider/model/dealerServicer')
const dealerPrice = require("../model/dealerPrice");
const users = require("../../User/model/users");

module.exports = class dealerService {
    // Get all dealers
    static async createRelationWithServicer(data) {
        try {
            const relations = await relationTable.save(data)
            return relations;;
        } catch (error) {
            console.log(`Could not create the relation ${error}`);
        }
    }

    static async createRelationsWithServicer(data) {
        try {
            const relations = await relationTable.insertMany(data)
            return relations;;
        } catch (error) {
            console.log(`Could not create the relation ${error}`);
        }
    }

    static async getDealerRelations(query, projection) {
        try {
            const relations = await relationTable.find(query, projection)
            return relations;
        } catch (error) {
            console.log(`Could not fetch the relations ${error}`);
        }
    }

    static async getDealerRelationsAggregate(query, projection) {
        try {
            const relations = await relationTable.aggregate(query)
            return relations;
        } catch (error) {
            console.log(`Could not fetch the relations ${error}`);
        }
    }

    static async getDealerRelation(query, projection) {
        try {
            const relations = await relationTable.findOne(query, projection)
            return relations;
        } catch (error) {
            console.log(`Could not fetch the relation ${error}`);
        }
    }

    static async editDealerRelation(criteria, data, option) {
        try {
            const editData = await relationTable.findOneAndUpdate(criteria, data, option)
            return editData;
        } catch (error) {
            console.log("Unable to update the dealer realtion")
        }
    }

    static async deleteRelation(criteria) {
        const deleteRelation = await relationTable.deleteOne(criteria)
        return deleteRelation;
    }

    static async deleteRelations(criteria) {
        const deleteRelation = await relationTable.deleteMany(criteria)
        return deleteRelation;
    }
};