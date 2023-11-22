const { Service_Provider } = require("../model/serviceProvider");
const serviceResourceResponse = require("../utils/constant");
exports.getAllServices = async (req, res) => {
  try {
    const users = await Service_Provider.find();
    res.json(users);
  } catch (error) {
    res
      .status(serviceResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
