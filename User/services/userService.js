const user = require("../model/users");

module.exports = class userService {
  static async getAllUsers() {
    try {
      const allUsers = await user.find();
      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }
  static async findUser(query) {
    try {
      const allUsers = await user.find(query);
      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }
  static async findOneUser(query) {
    try {
      const loggedInUser = await user.findOne(query);
      return loggedInUser;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  static async createUser(data) {
    try {
      const response = await new user(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getUserById(userId) {
    try {
      const singleUserResponse = await user.findById({
        _id: userId,
      });
      return singleUserResponse;
    } catch (error) {
      console.log(`User not found. ${error}`);
    }
  }

  static async updateUser(data) {
    try {
      const updatedResponse = await user.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update user ${error}`);
    }
  }

  static async deleteUser(userId) {
    try {
      const deletedResponse = await user.findOneAndDelete(userId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete user ${error}`);
    }
  }
};
