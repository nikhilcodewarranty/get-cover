const dealerPrice = require("../model/dealerPrice");

module.exports = class dealerPriceService {
  // get all dealer prices 
  static async getAllDealerPrice() {
    try {
      const AllDealerPrice = await dealerPrice.find().sort({"createdAt":-1});
      return AllDealerPrice;
    } catch (error) {
      console.log(`Could not fetch dealer price ${error}`);
    }
  }

  // create new dealer price 
  static async createDealerPrice(data) {
    try {
      const response = await new dealerPrice(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async insertManyPrices(data) {
    try {
      const response = await dealerPrice.insertMany(data);
      return response;
      return response;
    } catch (error) {
      console.log(error);
    }
  }


  

  // get dealer price detail with ID
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

  // update dealer price by ID
  // static async updateDealerPrice(data) {
  //   try {
  //     const updatedResponse = await dealerPrice.updateOne(
  //       { data },
  //       { $set: { date: new Date.now() } }
  //     );

  //     return updatedResponse;
  //   } catch (error) {
  //     console.log(`Could not update dealer price ${error}`);
  //   }
  // }

  static async updateDealerPrice(criteria, newValue, option) {
    try {
      const updatedResponse = await dealerPrice.updateMany(criteria, newValue, option);     
      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer book ${error}`);
    }
  }

  // delete dealer price with ID
  static async deleteDealerPrice(dealerPriceId) {
    try {
      const deletedResponse = await dealerPrice.findOneAndDelete(dealerPriceId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete dealer price ${error}`);
    }
  }
};
