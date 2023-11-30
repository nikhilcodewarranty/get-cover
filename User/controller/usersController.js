const { Users } = require("../model/users");
const { Roles } = require("../model/role");
const userResourceResponse = require("../utils/constant");
const userService = require("../services/userService");
const users = require("../model/users");
const role = require("../model/role");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
exports.getAllusers = async (req, res, next) => {
  try {
    const users = await userService.getAllusers();
    if (!users) {
      res.status(404).json("There are no user published yet!");
    }
    res.json(users);
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const createdUser = await userService.createUser(req.body);
    if (!createdUser) {
      res.status(404).json("There are no user created yet!");
    }
    res.json(createdUser);
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const singleUser = await userService.getUserById(userId);
    if (!singleUser) {
      res.status(404).json("There are no user found yet!");
    }
    res.json(singleUser);
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const updateUser = await userService.updateUser(req.body);
    if (!updateUser) {
      res.status(404).json("There are no user updated yet!");
    }
    res.json(updateUser);
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const deleteUser = await userService.deleteUser(req.body.id);
    if (!deleteUser) {
      res.status(404).json("There are no user deleted yet!");
    }
    res.json(deleteUser);
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};
exports.createSuperAdmin = async (req, res) => {
  try {
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create a new user with the provided data
    const savedUser =  await userService.createUser({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword,
      accountId: req.body.accountId,
      phoneNumber: req.body.phoneNumber,
      roleId:req.body.roleId, // Assign super role
      is_primary: req.body.is_primary,
      status: req.body.status,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      "your_secret_key", // Replace with your secret key
      { expiresIn: "1h" }
    );

    res.status(201).json({ token, userId: savedUser._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
         return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      "your_secret_key", // Replace with your secret key
      { expiresIn: "1h" }
    );

    res.status(200).json({ token, userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};