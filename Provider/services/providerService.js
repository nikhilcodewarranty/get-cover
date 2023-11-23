const serviceProvider = require("../model/serviceProvider");

module.exports = class providerService {
  static async getAllServiceProvider() {
    try {
      const allServiceProvider = await serviceProvider.find();
      return allServiceProvider;
    } catch (error) {
      console.log(`Could not fetch service provider ${error}`);
    }
  }

  static async createServiceProvider(data) {
    try {
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getServiceProviderById(serviceProviderId) {
    try {
      const singleServiceProviderResponse = await serviceProvider.findById({
        _id: serviceProviderId,
      });
      return singleServiceProviderResponse;
    } catch (error) {
      console.log(`Service provider not found. ${error}`);
    }
  }

  static async updateServiceProvider(data) {
    try {
      const updatedResponse = await serviceProvider.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update service provider ${error}`);
    }
  }

  static async deleteServiceProvider(serviceProviderId) {
    try {
      const deletedResponse = await serviceProvider.findOneAndDelete(
        serviceProviderId
      );
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete service provider ${error}`);
    }
  }
};
