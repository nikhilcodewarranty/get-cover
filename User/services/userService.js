const user = require("../model/users");
const role = require("../model/role");


//-------------------------- user's services ------------------------------//

module.exports = class userService {
  // get all users
  static async getAllUsers() {
    try {
      const allUsers = await user.aggregate([
        // Join with user_role table
        {
          $lookup: {
            from: "roles",
            localField: "roleId",
            foreignField: "_id",
            as: "user_role"
          }
        },
        { $unwind: "$user_role" },
        {
          $project: {
            _id: 1,
            email: 1,
            firstName: 1,
            lastName: 1,
            role: "$user_role.role",
            accountId: 1
          }
        }
      ]).sort({ "createdAt": -1 });

      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  //find user
  static async findUser(query) {
    try {
      const allUsers = await user.find(query);
      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  //find user for unique checks
  static async findOneUser(query) {
    try {
      const loggedInUser = await user.findOne(query);
      return loggedInUser;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  //create user 
  static async createUser(data) {
    try {
      console.log('first step______---------------')
      const response = await new user(data).save();
      console.log('second step______---------------')
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  // get user detail with id
  static async getUserById(userId, projection) {
    try {
      const singleUserResponse = await user.findById({ _id: userId, }, { projection });
      return singleUserResponse;
    } catch (error) {
      console.log(`User not found. ${error}`);
    }
  };

  //update user details with ID
  static async updateUser(criteria, data, option) {
    try {
      const updatedResponse = await user.findOneAndUpdate(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update user ${error}`);
    }
  };

  //delete user with ID
  static async deleteUser(criteria, newValue, option) {
    try {
      const deletedResponse = await user.findOneAndUpdate(criteria, newValue, option);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete user ${error}`);
    }
  };

  //get all roles
  static async getAllRoles(query, projection) {
    try {
      const roles = await role.find(query, projection).sort({ "createdAt": -1 });
      return roles;
    } catch (error) {
      console.log(`Could not find role ${error}`);
    }
  };

  //add role
  static async addRole(data) {
    try {
      const response = await new role(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  static async getRoleById(query, projection) {
    try {
      const response = await role.findOne(query, projection)
      return response
    } catch (err) {
      console.log(err);

    }
  }
};
