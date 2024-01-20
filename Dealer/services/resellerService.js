const reseller = require("../model/reseller")
const user = require('../../User/model/users')

module.exports = class resellerService {
    static async createReseller(data) {
        try {
            let createReseller = await new reseller(data).save();
            return createReseller;
        } catch (err) {
            console.log(`Unable to create the reseller ${err}`)
        }
    }

    static async getResellers(query, projection) {
        try {
            let getResellers = await reseller.find(query, projection)
            return getResellers;
        } catch (err) {
            console.log(`Unable to get the resellers err: ${err}`)
        }
    }

    static async getReseller(query, projection) {
        try {
            let getResellers = await reseller.findOne(query, projection)
            return getResellers;
        } catch (err) {
            console.log(`Unable to get the resellers err: ${err}`)
        }
    }

    static async getResellersCount(query) {
        try {
            const allReselers = await reseller.find(query).sort({ 'unique_key': -1 });
            return allReselers.sort((a, b) => b.unique_key - a.unique_key);
        } catch (error) {
            console.log(`Could not fetch customer ${error}`);
        }
    }

}