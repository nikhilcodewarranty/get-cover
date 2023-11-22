const { ServiceProvider } = require("../model/serviceProvider");
exports.getAllServices = async (req, res) => {
  try {
    const users = await ServiceProvider.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
