const {Users}=require('../model/User');
const {Roles}=require('../model/Role');
exports.getAllUsers = async (req, res) => {
    try {
      const users = await Users.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };