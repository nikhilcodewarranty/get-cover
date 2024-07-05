const order = require("../model/order");

module.exports = class orderService {
  static async getAllOrders(query, project) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },
        {
          $project: project,
        },
        {
          "$addFields": {
            "noOfProducts": {
              "$sum": "$productsArray.checkNumberProducts"
            },
            totalOrderAmount: { $sum: "$orderAmount" },

          }
        },
        { $sort: { unique_key_number: -1 } }
      ]).sort({createdAt:-1})
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrderWithContract(query, skipLimit, limitData) {
    try {
      const allOrders = await order.aggregate(query).sort({createdAt:-1}).skip(skipLimit).limit(limitData)
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getAllOrders1(query) {
    try {
      const allOrders = await order.aggregate(query).sort({createdAt:-1})
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrderWithContract1(query, skipLimit, limitData) {
    try {

      const allOrders = await order.aggregate(query).sort({createdAt:-1});
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getDashboardData(query, project) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },
        // {
        //   $project: project,
        // },
        {
          "$group": {
            "_id": "",
            "totalAmount": {
              "$sum": {
                "$sum": "$orderAmount"
              }
            },
            "totalOrder": { "$sum": 1 }
          },

        },


      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getAllOrderInCustomers(query, project, groupBy) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },
        {
          $project: project,

        },
        {
          $group: {
            _id: groupBy,
            noOfOrders: { $sum: 1 },
            orderAmount: {
              $sum: "$orderAmount"
            },
          }
        },
        { $sort: { unique_key: -1 } }
      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getGroupingOrder(query, project) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },

        {
          $project: project,
        },
        {
          $group: {
            _id: "$dealerId",
            customerId: { $first: "$customerId" },
            resellerId: { $first: "$resellerId" },
            totalOrderAmount: { $sum: "$orderAmount" },
            noOfOrders: { $sum: 1 },
            checkNumberProducts: {
              $sum: {
                $sum: "$productsArray.checkNumberProducts"
              }
            },
          }
        },
        { $sort: { unique_key: -1 } }
      ])
      return allOrders;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrder(query, projection) {
    try {
      const getOrder = await order.findOne(query, projection)
      return getOrder;
    } catch (error) {
      console.log(`Could not fetch order ${error}`);
    }
  }

  static async getOrders(query, projection) {
    try {
      let orders = await order.find(query, projection)
      return orders
    } catch (err) {
      console.log(`Could not fetch order ${err}`);
    }
  }

  static async getOrdersCount() {
    try {
      const count = await order.find({}, { unique_key_number: 1 }).sort({ unique_key_number: -1 });
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);;
    } catch (error) {
      console.log(`Could not fetch order count ${error}`);
    }
  }


  static async getOrdersCount1(query) {
    try {
      const count = await order.find(query).countDocuments();
      return count;
    } catch (error) {
      console.log(`Could not fetch order count ${error}`);
    }
  }

  static async getLastFive(query) {
    try {
      const lastFive = await order.find(query).sort({unique_key_number: -1}).limit(5)
      return lastFive;
    } catch (error) {
      console.log(`Could not fetch order count ${error}`);
    }
  }

  //Add order
  static async addOrder(data) {
    try {
      const createOrder = await order(data).save();
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }

  static async updateOrder(criteria, data, option) {
    try {
      const createOrder = await order.findOneAndUpdate(criteria, data, option);
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }
  static async updateManyOrder(criteria, data, option) {
    try {
      const createOrder = await order.updateMany(criteria, data, option);
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }

  static async changeDate(criteria, data, option) {
    try {
      const createOrder = await order.updateMany(criteria, data, option);
      return createOrder;
    } catch (error) {
      console.log(`Could not add order ${error}`);
    }
  }
  


};
