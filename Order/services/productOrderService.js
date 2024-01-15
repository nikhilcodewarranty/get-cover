const productOrder = require("../model/productOrder");

module.exports = class productOrderService {
  static async getAllproductOrders() {
    try {
      const allproductOrders = await productOrder.find();
      return allproductOrders;
    } catch (error) {
      console.log(`Could not fetch product orders ${error}`);
    }
  }

};
