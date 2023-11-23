const customers = require("../model/customer");

module.exports = class customerService {
  static async getAllCustomers() {
    try {
      const allCustomers = await customers.find();
      return allCustomers;
    } catch (error) {
      console.log(`Could not fetch customers ${error}`);
    }
  }

  static async createCustomers(data) {
    try {
      const response = await new customers(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getCustomerById(customerId) {
    try {
      const singleCustomerResponse = await customers.findById({
        _id: customerId,
      });
      return singleCustomerResponse;
    } catch (error) {
      console.log(`Customer not found. ${error}`);
    }
  }

  static async updateCustomer(data) {
    try {
      const updateResponse = await customers.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update customer ${error}`);
    }
  }

  static async deleteCustomer(customerId) {
    try {
      const deletedResponse = await customers.findOneAndDelete(customerId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete customer ${error}`);
    }
  }
};
