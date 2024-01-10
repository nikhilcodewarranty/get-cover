const customer = require("../model/customer");

module.exports = class customerService {
  static async getAllCustomers(query, projection) {
    try {
      const allCustomers = await customer.find(query, projection).sort({ 'createdAt': -1 });
      return allCustomers;
    } catch (error) {
      console.log(`Could not fetch customer ${error}`);
    }
  }

  static async getCustomersCount(query) {
    try {
      const allCustomers = await customer.find(query).sort({ 'unique_key': -1 });
      return allCustomers.sort((a, b) => b.unique_key - a.unique_key);;
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

  static async getCustomerByName(query) {
    try {
      const singleCustomerResponse = await customer.findOne(query);
      return singleCustomerResponse;
    } catch (error) {
      console.log(`Customer not found. ${error}`);
    }
  }

  static async getCustomerById(customerId) {
    try {
      const singleCustomerResponse = await customer.findOne(customerId);
      return singleCustomerResponse;
    } catch (error) {
      console.log(`Customer not found. ${error}`);
    }
  }

  static async updateCustomer(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateOne(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update customer ${error}`);
    }
  }


  static async updateDealerName(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);

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

  // Inactive Dealer Customer
  static async updateCustomerData(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update customer ${error}`);
    }
  }


};
