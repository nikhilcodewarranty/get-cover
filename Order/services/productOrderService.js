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

  static async createProductOrder(data) {
    try {
      const response = await new productOrder(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getProductOrderById(productOrderId) {
    try {
      const singleProductOrderResponse = await productOrder.findById({
        _id: productOrderId,
      });
      return singleProductOrderResponse;
    } catch (error) {
      console.log(`Product order not found. ${error}`);
    }
  }

  static async updateProductOrder(data) {
    try {
      const updatedResponse = await productOrder.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update product order ${error}`);
    }
  }

  static async deleteProductOrder(productOrderId) {
    try {
      const deletedResponse = await productOrder.findOneAndDelete(
        productOrderId
      );
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete product order ${error}`);
    }
  }
};
