const serviceProvider = require("../model/serviceProvider");

module.exports = class providerService {
  // Get all service providers based on a query and projection
  static async getAllServiceProvider(query, projection) {
    try {
      const allServiceProvider = await serviceProvider.find(query, projection).sort({ "createdAt": -1 });
      return allServiceProvider;
    } catch (error) {
      return `Could not fetch service provider: ${error}`;
    }
  }

  // Get the count of service providers
  static async getServicerCount() {
    try {
      const count = await serviceProvider.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      return `Could not fetch servicer count: ${error}`;
    }
  }
  // Get top five service providers based on a query
  static async getTopFiveServicer(query) {
    try {
      const topServicer = await serviceProvider.aggregate(query);
      return topServicer;
    } catch (error) {
      return `Could not find servicer: ${error}`;
    }

  }
  // Create a new service provider
  static async createServiceProvider(data) {
    try {
      console.log(data)
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      return `Could not create service provider: ${error}`;
    }
  }

  // Get aggregated data of service providers based on a query
  static async getAggregateServicer(query) {
    try {
      const response = await serviceProvider.aggregate(query)
      return response;
    } catch (error) {
      return `Could not fetch aggregate servicer: ${error}`;
    }
  }

  // Get a single service provider by query
  static async getServiceProviderById(query) {
    try {
      const singleServiceProviderResponse = await serviceProvider.findOne(query);
      return singleServiceProviderResponse;
    } catch (error) {
      return `Could not fetch servicer: ${error}`;
    }
  }
  // Update a service provider based on criteria and new data
  static async updateServiceProvider(criteria, data) {
    try {
      const updatedResponse = await serviceProvider.findOneAndUpdate(criteria, data, { new: true });
      return updatedResponse;
    } catch (error) {
      return `Could not update service provider: ${error}`;
    }
  }

  // Register a new service provider
  static async registerServiceProvider(data) {

    try {
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      return `Could not register service provider: ${error}`;
    }
  }

  // Update the status of a service provider based on criteria and new values
  static async statusUpdate(criteria, newValue, option) {
    try {
      const updatedResult = await serviceProvider.findByIdAndUpdate(
        criteria,
        newValue,
        option
      );
      return updatedResult;
    } catch (error) {
      return `Could not update status: ${error}`;
    }
  }

  // Get a service provider by name
  static async getServicerByName(query, projection) {
    try {
      const singleDealerResponse = await serviceProvider.findOne(query, projection);
      return singleDealerResponse;
    } catch (error) {
      return `Could not find servicer: ${error}`;
    }
  }
  // Delete a service provider by query
  static async deleteServicer(query) {
    try {
      const singleDealerResponse = await serviceProvider.deleteOne(query);
      return singleDealerResponse;
    } catch (error) {
      return `Could not delete servicer: ${error}`;
    }
  }

};