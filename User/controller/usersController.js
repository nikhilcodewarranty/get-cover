require("dotenv").config();
// const { Users } = require("../model/users");
// const { Roles } = require("../model/role");
const userResourceResponse = require("../utils/constant");
//console.log(userResourceResponse)
const userService = require("../services/userService");
const dealerService = require('../../Dealer/services/dealerService')
const users = require("../model/users");
const role = require("../model/role");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const constant = require('../../config/constant')


exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    if (!users) {
      res.status(404).json("There are no user published yet!");
    }
      res.send({
        code: constant.successCode,
        message: "Success",
        result: {
          users: users
        }
      })
  } catch (error) {
    res
      .status(constant.errorCode)
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

    // console.log(data)
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
    let userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: data.accountId,
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, // Assign super role
      is_primary: data.is_primary,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = userService.createUser(userData);

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

exports.createDealer = async (req, res) => {
  try {
    let data = req.body
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email already exist"
      })
      return;
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    // Create a new dealer meta data
    let dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy
    }
    let createMetaData = await dealerService.createDealer(dealerMeta)
    if (!createMetaData) {
      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      })
      return;
    }
    let checkRole = await role.findOne({ role: data.role })
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      })
      return;
    }

    let dealerData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: createMetaData._id,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id, // Assign super role
      isPrimary: data.is_primary,
    }

    let createDealer = await userService.createUser(dealerData)

    if (createDealer) {
      let result = createDealer.toObject()
      result.role = data.role
      result.meta = createMetaData
      const token = jwt.sign(
        { userId: createDealer._id, email: createDealer.email },
        process.env.JWT_SECRET, // Replace with your secret key
        { expiresIn: "1h" }
      );
      res.send({
        code: constant.successCode,
        message: 'Successfully Created',
        result: result,
        jwtToken: token
      })
    } else {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the dealer"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
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

    console.log('check user++++++++++++++++++',user,req.body.password)
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
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email
      }
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllRoles = async (req, res, next) => {
  try {
    const users = await userService.getAllRoles();
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

exports.addRole = async (req, res, next) => {
  try {
    const createdUser = await userService.addRole(req.body);
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

// exports.sendLinkToEmail = async(req,res)=>{
//   try{
//     let data = req.body
//     let checkEmail = await userService.findOneUser({email:data.email})
//     if(!checkEmail){
//       res.send({
//         code:constant.errorCode,
//         message:"Invalid email"
//       })
//     }else{

//     }
//   }catch(err){
//     res.send({
//       code:constant.errorCode,
//       message:err.message
//     })
//   }
// }