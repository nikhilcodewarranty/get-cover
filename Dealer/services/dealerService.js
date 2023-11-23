const dealers = require("../model/dealer");

module.exports = class dealerService {
  static async getAllDealers() {
    try {
      const AllDealers = await dealers.find();
      return AllDealers;
    } catch (error) {
      console.log(`Could not fetch dealers ${error}`);
    }
  }

  static async createDealers(data) {
    try {
      const response = await new dealers(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getDealerById(dealerId) {
    try {
      const singleDealerResponse = await dealers.findById({
        _id: dealerId,
      });
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

  static async updateDealer(data) {
    try {
      const updateResponse = await dealers.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update dealer ${error}`);
    }
  }

  static async deleteDealer(dealerId) {
    try {
      const deletedResponse = await dealers.findOneAndDelete(dealerId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete dealer ${error}`);
    }
  }
};
