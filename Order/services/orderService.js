const order = require("../model/order");

module.exports = class orderService {
  static async getAllOrders(query, project) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },
        {
          $project: project,

        },
        {
          "$addFields": {
            "noOfProducts": {
              "$sum": "$productsArray.noOfProducts"
            }
          }
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

  static async getOrders(query, projection) {
    try {
      let orders = await order.find(query, projection)
      return orders
    } catch (err) {
      console.log(`Could not fetch order ${err}`);
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

  static async updateOrder(criteria, data, option) {
    try {
      const createOrder = await order.findOneAndUpdate(criteria, data, option);
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }


};
