const order = require("../model/order");

module.exports = class orderService {
  static async getAllOrders() {
    try {
      const allOrders = await order.aggregate([
        {
          $project: {
            noOfProducts: { $size: '$productsArray' },
            dealerId:1,
            unique_key:1,
            servicerId:1,
            customerId:1,
            paymentStatus:1,
            status:1,
            dealerPurchaseOrder:1,
            orderAmount:1
          }
        }
      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrdersCount() {
    try {
      const count = await order.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      console.log(`Could not fetch order count ${error}`);
    }
  }

  //Add order

  static async addOrder(data) {
    try {
      const createOrder = await order(data).save();
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }


};
