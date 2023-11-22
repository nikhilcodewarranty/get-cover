const { Orders } = require("../model/order");
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

exports.createOrders = async (req, res, next) => {
  try {
    const createOrders = await orderService.createOrders(req.body);
    if (!createOrders) {
      res.status(404).json("There are no order created yet!");
    }
    res.json(createOrders);
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
    const updateOrder = await orderService.updateOrder(req.body);
    if (!updateOrder) {
      res.status(404).json("There are no order updated yet!");
    }
    res.json(updateOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const deleteOrder = await orderService.deleteOrder(req.body.id);
    if (!deleteOrder) {
      res.status(404).json("There are no order deleted yet!");
    }
    res.json(deleteOrder);
  } catch (error) {
    res
      .status(orderResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
