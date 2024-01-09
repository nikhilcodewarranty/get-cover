const user = require("../model/users");
const role = require("../model/role");
const notification = require("../model/notification");
const terms = require("../model/terms");
const dealerModel = require("../../Dealer/model/dealer");
const { userConnection } = require("../../db");

//-------------------------- user's services ------------------------------//

module.exports = class userService {
  // get all users
  static async getAllUsers(query, projection) {
    try {
      const allUsers = await user.aggregate([
        {
          $match: {
            roleId: query.roleId
          }
        },
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


      /**--------------------------Get account name from accoun ID iN diffrent database-------------------------- */



      return allUsers;
    } catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  //find user
  static async findUser(query) {
    try {
      const allUsers = await user.find(query).sort({isPrimary:-1});
      console.log("===================",allUsers)
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
      const response = await new user(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  };




  static async insertManyUser(data) {
    try {
      const response = await user.insertMany(data);
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

  static async getUserById1(userId, projection) {
    try {
      console.log("query---------------", userId)
      const singleUserResponse = await user.findOne(userId, projection);
      return singleUserResponse;
    } catch (error) {
      console.log(`User not found. ${error}`);
    }
  };

  //update user details with ID
  static async updateUser(criteria, data, option) {
    try {
      const updatedResponse = await user.updateMany(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      console.log(`Could not update user ${error}`);
    }
  };

  //delete user with ID
  static async deleteUser(criteria) {
    try {
      const deletedResponse = await user.deleteMany(criteria);
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


  //get all TERMS
  static async getAllTerms(query, projection) {
    try {
      const allTerms = await terms.find(query, projection).sort({ "terms": 1 });
      return allTerms;
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

  //create term
  static async createTerms(data) {
    try {
      const response = await terms.insertMany(data);
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  //get role by id
  static async getRoleById(query, projection) {
    try {
      const response = await role.findOne(query, projection)
      return response
    } catch (err) {
      console.log(err);

    }
  }

  //find user by email
  static async findByEmail(query) {
    try {
      // const response = await user.find({ 'email': { $in: query } }).select('-_id email');
      const response = await user.aggregate([
        {
          $match: {
            email: { $in: query }
          }
        },
        {
          $addFields: {
            flag: true
          }
        },
        {
          $project: {
            _id: 0,
            email: 1,
            flag: 1
          }
        }
      ]);

      return response;
      // const response = await user.aggregate([
      //   {
      //     $facet: {
      //       matchingResults: [
      //         { $match: { 'email': { $in: query } } },
      //         { $addFields: { exist: 1 } },
      //         { $project: { _id: 0, email: 1, exist: 1 } },

      //       ],
      //       nonMatchingResults: [
      //         { $match: { 'email': { $nin: query } } },
      //         { $addFields: { exist: 0 } },
      //         { $project: { _id: 0, email: 1, exist: 1 } }
      //       ]
      //     }
      //   },
      //   {
      //     $project: {
      //       allResults: { $concatArrays: ['$matchingResults', '$nonMatchingResults'] }
      //     }
      //   }
      // ]).exec();
      return response;
    } catch (err) {
      console.log(err);

    }
  }


  static async createTerms(data) {
    try {
      const response = await terms.insertMany(data);
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  //get role by id
  static async getDealersUser(query, projection) {
    try {
      const response = await user.find(query, projection).sort({ "createdAt": -1 });
      return response
    } catch (err) {
      console.log(err);

    }
  }

  static async getServicerUser(query, projection) {
    try {
      const response = await user.find(query, projection).sort({ "createdAt": -1 });
      return response
    } catch (err) {
      console.log(err);

    }
  }

  //create user 
  static async createNotification(data) {
    try {
      const response = await new notification(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  //get all roles
  static async getAllNotifications(query, projection) {
    try {
      const roles = await notification.find(query, projection).sort({ "createdAt": -1 });
      return roles;
    } catch (error) {
      console.log(`Could not find role ${error}`);
    }
  };

  static async getCountNotification() {
    try {
      const roles = await notification.countDocuments({ isDeleted: false, status: false })
      return roles;
    } catch (error) {
      console.log(`Could not find role ${error}`);
    }
  };

  static async updateNotification(criteria, newValue, option) {
    try {
      const updatedResponse = await notification.updateMany(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer book ${error}`);
    }
  }

  static async findUserforCustomer(query) {
    try {
      const fetchUser = await user.aggregate([
        {
          $match: query
        }
      ]).sort({createdAt:-1});
      return fetchUser;
    } catch (error) {
      console.log(`Could not update dealer book ${error}`);
    }
  }

  static async updateSingleUser(criteria, newValue, option) {
    try {
      const updatedResponse = await user.findOneAndUpdate(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer book ${error}`);
    }
  }

  static async getSingleUserByEmail(query, project) {
    try {
      let getUser = await user.findOne(query)
      return getUser;
    } catch (err) {
      console.log("service error:-", err.message)
    }
  }


};
