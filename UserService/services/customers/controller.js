const Customers = require('./model');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await Customers.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createUser = async (req, res) => {
  const { username, email } = req.body;

  try {
    const newUser = await Customers.create({ username, email });
    res.json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
