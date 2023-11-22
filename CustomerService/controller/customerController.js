const { Customers } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
exports.getAllCustomer = async (req, res) => {
  try {
    const users = await Customers.find();
    res.json(users);
  } catch (error) {
    res
      .status(customerResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
