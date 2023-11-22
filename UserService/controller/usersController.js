const { Users } = require("../model/user");
const { Roles } = require("../model/role");
exports.getAllUsers = async (req, res) => {
  try {
    const users = await Users.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
