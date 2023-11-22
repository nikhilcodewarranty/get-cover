
const {Orders}=require('../model/Order');
const orderResourceResponse = require('../utils/constant');
exports.getAllOrders = async (req, res) => {
    try {
      const orders = await Orders.find();
      res.json(orders);
    } catch (error) {
      res.status(orderResourceResponse.serverError.statusCode).json({ error: 'Internal server error' });
    }
  };