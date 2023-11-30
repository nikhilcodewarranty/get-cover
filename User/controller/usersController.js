require("dotenv").config();
const { Users } = require("../model/users");
const { Roles } = require("../model/role");
const userResourceResponse = require("../utils/constant");
console.log(userResourceResponse)
const userService = require("../services/userService");
const users = require("../model/users");
const role = require("../model/role");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
exports.getAllusers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
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
    let data = req.body
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: 401,
        message: "Email already exist"
      })
      return;
    }

    // Check if the provided role is 'super'
    const superRole = await role.findOne({ role: "super" });
    if (!superRole) {
      res.send({
        code: 401,
        message: "Role not found"
      })
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create a new user with the provided data
    const savedUser = userService.createUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: data.accountId,
      phoneNumber: data.phoneNumber,
      roleId: '65672dd3c8f0946352589287', // Assign super role
      is_primary: data.is_primary,
      status: data.status,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "1h" }
    );

    res.send({
      code: 200,
      message: "Account created successfully"
    })
  } catch (error) {
    res.send({
      code: 401,
      message: error.message
    });
  }
};

// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email });
    if (!user) {
      res.send({
        code: 401,
        message: "Invalid Credentials"
      })
      return;
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      res.send({
        code: 401,
        message: "Invalid Credentials"
      })
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "1h" }
    );

    res.send({
      code: 200,
      message: "Login Successful",
      result:{
        token:token,
        email:user.email
      }
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};