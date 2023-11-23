const users = require("../model/users");

module.exports = class userService {
  static async getAllUsers() {
    try {
      const allUsers = await users.find();
      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  static async createUser(data) {
    try {
      const response = await new users(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getUserById(userId) {
    try {
      const singleUserResponse = await users.findById({
        _id: userId,
      });
      return singleUserResponse;
    } catch (error) {
      console.log(`User not found. ${error}`);
    }
  }

  static async updateUser(data) {
    try {
      const updateResponse = await users.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update user ${error}`);
    }
  }

  static async deleteUser(userId) {
    try {
      const deletedResponse = await users.findOneAndDelete(userId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete user ${error}`);
    }
  }
};
