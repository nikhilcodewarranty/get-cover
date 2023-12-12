const priceBook = require("../model/priceBook");
const priceCategory = require("../model/priceCategory");

module.exports = class priceBookService {

  //get all price book 
  static async getAllPriceBook(query, projection) {
    try {
      const allPriceBook = await priceBook.find(query, projection)
      .populate({
        path: 'category',
        select: 'name', // Specify the fields you want to retrieve from the 'category' collection
        as:"data"
      }).sort({'createdAt':-1});
      return allPriceBook;
    } catch (error) {
      console.log(`Could not fetch price book ${error}`);
    }
  }

  static async getTotalCount() {
    try {
      const count = await priceCategory.countDocuments();
      return count;
    } catch (error) {
      console.log(`Could not fetch price book ${error}`);
    }
  }
  

  //create new price book
  static async createPriceBook(data) {
    try {
      const response = await new priceBook(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  // get price book by ids
  static async getPriceBookById(query, projection) {
    try {
      const singlePriceBookResponse = await priceBook.findOne(query, projection);
      return singlePriceBookResponse;
    } catch (error) {
      console.log(`Price book not found. ${error}`);
    }
  }

  static async getAllPriceIds(query, projection) {
    try {
      const allIds = await priceBook.find(query, projection);
      return allIds;
    } catch (error) {
      console.log(`Price book not found. ${error}`);
    }
  }

  
  // update price book
  static async updatePriceBook(criteria, newValue, option) {
    try {
      const updatedResponse = await priceBook.updateMany(
        criteria,
        newValue,
        option
      );
      return updatedResponse;
    } catch (error) {
      console.log(`Could not update price book ${error}`);
    }
  }

  //delete price book
  static async deletePriceBook(criteria, newValue, option) {
    try {
      const deletedResponse = await priceBook.findOneAndUpdate(criteria, newValue, option);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete price book ${error}`);
    }
  }

  // ---------------------PRIVE CATEGORY SERVICES-------------- //

  //get price category by id service
  static async getPriceCatById(ID, projection) {
    try {
      const singlePriceCatResponse = await priceCategory.findOne(ID, projection);
      return singlePriceCatResponse;
    } catch (error) {
      console.log(`Price category not found. ${error}`);
    }
  }
  //get price category by name service
  static async getPriceCatByName(name, projection) {
    try {
      const singlePriceCatResponse = await priceCategory.findOne(name, projection);
      return singlePriceCatResponse;
    } catch (error) {
      console.log(`Price category not found. ${error}`);
    }
  }
  //create price category  service
  static async createPriceCat(data) {
    try {
      const response = await new priceCategory(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  //get price categories service
  static async getAllPriceCat(query, projection) {
    try {
      const allPriceCategories = await priceCategory.find(query, projection).sort({"createAt":-1});
      return allPriceCategories;
    } catch (error) {
      console.log(`Could not fetch price categories ${error}`);
    }
  }

  // update price category
  static async updatePriceCategory(criteria, newValue, options) {
    try {
      const updatedPriceCat = await priceCategory.updateMany(
        criteria,
        newValue,
        options
      );
      return updatedPriceCat;
    } catch (error) {
      console.log(`Could not fetch price categories ${error}`);
    }
  }

  //get Dealer price  Books

  

};
