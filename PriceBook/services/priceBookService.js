const priceBook = require("../model/priceBook");
const priceCategory = require("../model/priceCategory");

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
      const updatedResponse = await priceBook.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
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

// ---------------------PRIVE CATEGORY SERVICES-------------- //

//get price category by id service
static async getPriceCatById(data) {
  try {
    const singlePriceCatResponse = await priceCategory.findOne(data);
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
static async getAllPriceCat(query,projection) {
  try {
    const allPriceCategories = await priceCategory.find(query,projection);
    return allPriceCategories;
  } catch (error) {
    console.log(`Could not fetch price categories ${error}`);
  }
}

// update price category

static async updatePriceCategory(criteria,newValue,options){
  try {
    const updatedPriceCat = await priceCategory.updateMany(criteria,newValue,options);
    return updatedPriceCat;
  } catch (error) {
    console.log(`Could not fetch price categories ${error}`);
  }
}


};
