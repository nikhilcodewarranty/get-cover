const order = require("../model/order");

module.exports = class orderService {
  // Get all orders
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
      ]).sort({ createdAt: -1 });
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get order with contract
  static async getOrderWithContract(query, skipLimit, limitData) {
    try {
      const allOrders = await order.aggregate(query).sort({ createdAt: -1 }).skip(skipLimit).limit(limitData);
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get order with contract with unique key number
  static async getOrderWithContract1(query, skipLimit, limitData) {
    try {
      const allOrders = await order.aggregate(query).sort({ unique_key_number: -1 }).skip(skipLimit).limit(limitData);
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get all orders with query
  static async getAllOrders1(query) {
    try {
      const allOrders = await order.aggregate(query).sort({ createdAt: -1 });
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get order with contract sorted by createdAt
  static async getOrderWithContract1(query, skipLimit, limitData) {
    try {
      const allOrders = await order.aggregate(query).sort({ createdAt: -1 });
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get dashboard data
  static async getDashboardData(query, project) {
    try {
      const allOrders = await order.aggregate([
        {
          $match: query
        },
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
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get all orders in customers
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
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get grouping order
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
      ]);
      return allOrders;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get order with query and projection
  static async getOrder(query, projection) {
    try {
      const getOrder = await order.findOne(query, projection);
      return getOrder;
    } catch (error) {
      return `Could not fetch order: ${error}`;
    }
  }

  // Get orders with query and projection
  static async getOrders(query, projection) {
    try {
      let orders = await order.find(query, projection);
      return orders;
    } catch (err) {
      return `Could not fetch order: ${err}`;
    }
  }

  // Get orders count
  static async getOrdersCount() {
    try {
      const count = await order.find({}, { unique_key_number: 1 }).sort({ unique_key_number: -1 });
      return count.sort((a, b) => b.unique_key_number - a.unique_key_number);
    } catch (error) {
      return `Could not fetch order count: ${error}`;
    }
  }

  // Get orders count with query
  static async getOrdersCount1(query) {
    try {
      const count = await order.find(query).countDocuments();
      return count;
    } catch (error) {
      return `Could not fetch order count: ${error}`;
    }
  }

  // Get last five orders
  static async getLastFive(query) {
    try {
      const lastFive = await order.find(query).sort({ unique_key_number: -1 }).limit(5);
      return lastFive;
    } catch (error) {
      return `Could not fetch orders: ${error}`;
    }
  }

  // Add order
  static async addOrder(data) {
    try {
      const createOrder = await order(data).save();
      return createOrder;
    } catch (error) {
      return `Could not add order: ${error}`;
    }
  }

  // Update order
  static async updateOrder(criteria, data, option) {
    try {
      const createOrder = await order.findOneAndUpdate(criteria, data, option);
      return createOrder;
    } catch (error) {
      return `Could not update order: ${error}`;
    }
  }

  // Update many orders
  static async updateManyOrder(criteria, data, option) {
    try {
      const createOrder = await order.updateMany(criteria, data, option);
      return createOrder;
    } catch (error) {
      return `Could not update orders: ${error}`;
    }
  }

  // Change date for orders
  static async changeDate(criteria, data, option) {
    try {
      const createOrder = await order.updateMany(criteria, data, option);
      return createOrder;
    } catch (error) {
      return `Could not change order date: ${error}`;
    }
  }
};
