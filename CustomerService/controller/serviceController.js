const {Service_Provider}=require('../model/Service_Provider');
exports.getAllServices = async (req, res) => {
    try {
      const users = await Service_Provider.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };