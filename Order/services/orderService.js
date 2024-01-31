const order = require("../model/order");

module.exports = class orderService {
  static async getAllOrders() {
    try {
      const allOrders = await order.aggregate([
        {
          $project: {
            // "shop": { $arrayElemAt: ["$productsArray", 0] },
            productsArray: 1,
            dealerId: 1,
            unique_key: 1,
            servicerId: 1,
            customerId: 1,
            resellerId: 1,
            paymentStatus: 1,
            status: 1,
            venderOrder: 1,
            orderAmount: 1
          },

        },
        { $sort: { unique_key: -1 } }
      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrder(query, projection) {
    try {
      const getOrder = await order.findOne(query, projection)
      return getOrder;
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

  static async updateOrder(data) {
    try {
      const createOrder = await order(data).save();
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }


};
