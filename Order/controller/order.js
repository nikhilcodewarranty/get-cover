const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getAllOrders();
    if (!orders) {
      res.status(404).json("There are no order published yet!");
    }
    res.json(orders);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const createOrder = await orderService.createOrder(req.body);
    if (!createOrder) {
      res.status(404).json("There are no order created yet!");
    }
    res.json(createOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const singleOrder = await orderService.getOrderById(orderId);
    if (!singleOrder) {
      res.status(404).json("There are no order found yet!");
    }
    res.json(singleOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const updatedOrder = await orderService.updateOrder(req.body);
    if (!updatedOrder) {
      res.status(404).json("There are no order updated yet!");
    }
    res.json(updatedOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const deletedOrder = await orderService.deleteOrder(req.body.id);
    if (!deletedOrder) {
      res.status(404).json("There are no order deleted yet!");
    }
    res.json(deletedOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
