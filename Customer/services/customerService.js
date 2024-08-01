const customer = require("../model/customer");

module.exports = class customerService {
  // getAllCustomers function
  static async getAllCustomers(query, projection) {
    try {
      const allCustomers = await customer.find(query, projection).sort({ 'createdAt': -1 });
      return allCustomers;
    } catch (error) {
      return `Could not fetch customer ${error}`;
    }
  }

  // getCustomersCount function
  static async getCustomersCount(query) {
    try {
      const allCustomers = await customer.find(query).sort({ 'unique_key': -1 });
      return allCustomers.sort((a, b) => b.unique_key - a.unique_key);
    } catch (error) {
      return `Could not fetch customer ${error}`;
    }
  }

  // createCustomer function
  static async createCustomer(data) {
    try {
      const response = await new customer(data).save();
      return response;
    } catch (error) {
      return error;
    }
  }

  // getCustomerByName function
  static async getCustomerByName(query) {
    try {
      const singleCustomerResponse = await customer.findOne(query);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // getCustomerById function
  static async getCustomerById(customerId) {
    try {
      const singleCustomerResponse = await customer.findOne(customerId);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // getCustomerByAggregate function
  static async getCustomerByAggregate(query) {
    try {
      const singleCustomerResponse = await customer.aggregate(query);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // updateCustomer function
  static async updateCustomer(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateOne(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update customer ${error}`;
    }
  }

  // updateDealerName function
  static async updateDealerName(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update dealer ${error}`;
    }
  }

  // deleteCustomer function
  static async deleteCustomer(customerId) {
    try {
      const deletedResponse = await customer.findOneAndDelete(customerId);
      return deletedResponse;
    } catch (error) {
      return `Could not delete customer ${error}`;
    }
  }

  // updateCustomerData function
  static async updateCustomerData(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update customer ${error}`;
    }
  }
};
