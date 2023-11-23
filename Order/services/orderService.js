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

  static async createOrder(data) {
    try {
      const response = await new order(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getOrderById(orderId) {
    try {
      const singleOrderResponse = await order.findById({
        _id: orderId,
      });
      return singleOrderResponse;
    } catch (error) {
      console.log(`Order not found. ${error}`);
    }
  }

  static async updateOrder(data) {
    try {
      const updatedResponse = await order.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update order ${error}`);
    }
  }

  static async deleteOrder(orderId) {
    try {
      const deletedResponse = await order.findOneAndDelete(orderId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete order ${error}`);
    }
  }
};
