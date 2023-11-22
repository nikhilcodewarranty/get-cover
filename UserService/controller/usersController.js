const { Users } = require("../model/users");
const { Roles } = require("../model/role");
const userResourceResponse = require("../utils/constant");
const userService = require("../services/userService");

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
