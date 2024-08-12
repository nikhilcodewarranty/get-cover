const dealer = require("../model/dealer");
const servier = require('../../Provider/model/serviceProvider')
const relationTable = require('../../Provider/model/dealerServicer')
const dealerPrice = require("../model/dealerPrice");
const users = require("../../User/model/users");

module.exports = class dealerService {
    // Create a relation with a service provider
    static async createRelationWithServicer(data) {
        try {
            const relations = await relationTable.save(data)
            return relations;;
        } catch (error) {
            return `Could not create the relations: ${error}`;
        }
    }

    // Create multiple relations with service providers
    static async createRelationsWithServicer(data) {
        try {
            const relations = await relationTable.insertMany(data)
            return relations;;
        } catch (error) {
            return `Could not fetch the relations: ${error}`;
        }
    }

    // Retrieve dealer relations based on a query
    static async getDealerRelations(query, projection) {
        try {
            const relations = await relationTable.find(query, projection)
            return relations;
        } catch (error) {
            console.log(`Could not fetch the relations ${error}`);
        }
    }
    // Retrieve dealer relations using aggregation
    static async getDealerRelationsAggregate(query, projection) {
        try {
            const relations = await relationTable.aggregate(query)
            return relations;
        } catch (error) {
            return `Could not fetch the relations using aggregation: ${error}`;
        }
    }
    // Retrieve a single dealer relation based on a query
    static async getDealerRelation(query, projection) {
        try {
            const relations = await relationTable.findOne(query, projection)
            return relations;
        } catch (error) {
            return `Could not fetch the relation: ${error}`;
        }
    }

    // Update a dealer relation based on criteria
    static async editDealerRelation(criteria, data, option) {
        try {
            const editData = await relationTable.findOneAndUpdate(criteria, data, option)
            return editData;
        } catch (error) {
            return `Unable to update the dealer relation: ${error}`;
        }
    }

    // Delete a single dealer relation based on criteria
    static async deleteRelation(criteria) {
        try {
            const deletedRelation = await relationTable.deleteOne(criteria);
            return deletedRelation;
        }
        catch (error) {
            return `Could not delete the relation: ${error}`;
        }
    }

    // Delete multiple dealer relations based on criteria
    static async deleteRelations(criteria) {
        try {
            const deletedRelations = await relationTable.deleteMany(criteria);
            return deletedRelations;
        } catch (error) {
            return `Could not delete the relations: ${error}`;
        }
    }
};