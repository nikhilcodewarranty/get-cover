const order = require("../model/order");

module.exports = class orderService {
  static async getAllOrders() {
    try {
      const allOrders = await order.find();
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

};
