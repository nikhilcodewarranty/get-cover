const { Orders } = require("../model/order");
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Orders.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
