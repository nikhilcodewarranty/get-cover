const priceBook = require("../model/priceBook");

module.exports = class priceBookService {
  static async getAllPriceBook() {
    try {
      const allPriceBook = await priceBook.find();
      return allPriceBook;
    } catch (error) {
      console.log(`Could not fetch price book ${error}`);
    }
  }

  static async createPriceBook(data) {
    try {
      const response = await new priceBook(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getPriceBookById(priceBookId) {
    try {
      const singlePriceBookResponse = await priceBook.findById({
        _id: priceBookId,
      });
      return singlePriceBookResponse;
    } catch (error) {
      console.log(`Price book not found. ${error}`);
    }
  }

  static async updatePriceBook(data) {
    try {
      const updateResponse = await priceBook.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update price book ${error}`);
    }
  }

  static async deletePriceBook(priceBookId) {
    try {
      const deletedResponse = await priceBook.findOneAndDelete(priceBookId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete price book ${error}`);
    }
  }
};
