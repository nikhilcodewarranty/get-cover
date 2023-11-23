const dealerPrice = require("../model/dealerPrice");

module.exports = class dealerPriceService {
  static async getAllDealerPrice() {
    try {
      const AllDealerPrice = await dealerPrice.find();
      return AllDealerPrice;
    } catch (error) {
      console.log(`Could not fetch dealer price ${error}`);
    }
  }

  static async createDealerPrice(data) {
    try {
      const response = await new dealerPrice(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getDealerPriceById(dealerPriceId) {
    try {
      const singleDealerPriceResponse = await dealerPrice.findById({
        _id: dealerPriceId,
      });
      return singleDealerPriceResponse;
    } catch (error) {
      console.log(`Dealer price not found. ${error}`);
    }
  }

  static async updateDealerPrice(data) {
    try {
      const updatedResponse = await dealerPrice.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer price ${error}`);
    }
  }

  static async deleteDealerPrice(dealerPriceId) {
    try {
      const deletedResponse = await dealerPrice.findOneAndDelete(dealerPriceId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete dealer price ${error}`);
    }
  }
};
