const serviceProvider = require("../model/serviceProvider");

module.exports = class providerService {
  static async getAllServiceProvider(query, projection) {
    try {
      const allServiceProvider = await serviceProvider.find(query, projection).sort({ "createdAt": -1 });
      return allServiceProvider;
    } catch (error) {
      console.log(`Could not fetch service provider ${error}`);
    }
  }


  static async getServicerCount() {
    try {
      const count = await serviceProvider.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      console.log(`Could not fetch price book ${error}`);
    }
  }

  static async getTopFiveServicer(query){
    try {
      const topServicer = await serviceProvider.aggregate(query);
      return topServicer;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }

  }

  static async createServiceProvider(data) {
    try {
      console.log(data)
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async getAggregateServicer(query) {
    try {
      const response = await serviceProvider.aggregate(query)
      return response;
    } catch (error) {
      console.log(error);
    }
  }


  static async getServiceProviderById(query) {
    try {
      const singleServiceProviderResponse = await serviceProvider.findOne(query);
      return singleServiceProviderResponse;
    } catch (error) {
      console.log(`Service provider not found. ${error}`);
    }
  }

  static async updateServiceProvider(criteria, data) {
    try {
      const updatedResponse = await serviceProvider.findOneAndUpdate(criteria, data, { new: true });
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

  static async registerServiceProvider(data) {

    try {
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }



  static async statusUpdate(criteria, newValue, option) {
    try {
      const updatedResult = await serviceProvider.findByIdAndUpdate(
        criteria,
        newValue,
        option
      );
      return updatedResult;
    } catch (error) {
      console.log(error);
    }
  }

  // Get servicer detail with Name
  static async getServicerByName(query, projection) {
    try {
      const singleDealerResponse = await serviceProvider.findOne(query, projection);
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

  static async deleteServicer(query) {
    try {
      const singleDealerResponse = await serviceProvider.deleteOne(query);
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

};
