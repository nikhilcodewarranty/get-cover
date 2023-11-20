
const {Customers}=require('../model/Customer');
exports.getAllCustomer = async (req, res) => {
    try {
      const users = await Customers.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };