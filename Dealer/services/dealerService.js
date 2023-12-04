const dealer = require("../model/dealer");

module.exports = class dealerService {
  static async getAllDealers() {
    try {
      const AllDealers = await dealer.find();
      return AllDealers;
    } catch (error) {
      console.log(`Could not fetch dealers ${error}`);
    }
  }

  static async createDealer(data) {
    try {
      console.log('data meta---------', data)
      const response = await new dealer(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getDealerById(dealerId) {
    try {
      const singleDealerResponse = await dealer.findOne({
        _id: dealerId,
      });
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

  static async updateDealer(data) {
    try {
      const updatedResponse = await dealer.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer ${error}`);
    }
  }

  static async deleteDealer(dealerId) {
    try {
      const deletedResponse = await dealer.findOneAndDelete(dealerId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete dealer ${error}`);
    }
  }
};
