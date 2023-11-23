const orders = require("../model/order");

module.exports = class orderService {
  static async getAllOrders() {
    try {
      const allOrders = await orders.find();
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch orders ${error}`);
    }
  }

  static async createOrder(data) {
    try {
      const response = await new orders(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getOrderById(orderId) {
    try {
      const singleOrderResponse = await orders.findById({
        _id: orderId,
      });
      return singleOrderResponse;
    } catch (error) {
      console.log(`Order not found. ${error}`);
    }
  }

  static async updateOrder(data) {
    try {
      const updateResponse = await orders.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update order ${error}`);
    }
  }

  static async deleteOrder(orderId) {
    try {
      const deletedResponse = await orders.findOneAndDelete(orderId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete order ${error}`);
    }
  }
};
