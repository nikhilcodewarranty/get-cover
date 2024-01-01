const customer = require("../model/customer");

module.exports = class customerService {
  static async getAllCustomers(query,projection) {
    try {
      const allCustomers = await customer.find(query,projection);
      return allCustomers;
    } catch (error) {
      console.log(`Could not fetch customer ${error}`);
    }
  }

  static async createCustomer(data) {
    try {
      const response = await new customer(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getCustomerByName(accountName) {
    try {
      const singleCustomerResponse = await customer.findOne({
        username: accountName,
      });
      return singleCustomerResponse;
    } catch (error) {
      console.log(`Customer not found. ${error}`);
    }
  }

  static async getCustomerById(customerId) {
    try {
      const singleCustomerResponse = await customer.findById({
        _id: customerId,
      });
      return singleCustomerResponse;
    } catch (error) {
      console.log(`Customer not found. ${error}`);
    }
  }

  static async updateCustomer(data) {
    try {
      const updatedResponse = await customer.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update customer ${error}`);
    }
  }

  static async deleteCustomer(customerId) {
    try {
      const deletedResponse = await customer.findOneAndDelete(customerId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete customer ${error}`);
    }
  }
};
