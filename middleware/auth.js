const { verify } = require('crypto');
const jwt = require('jsonwebtoken');
const users = require("../User/model/users")
// var config = require('../config/constanct');
// const config = process.env
verifyToken = async (req, res, next) => {
  let token = req.headers["x-access-token"];
  if (!token) {
    res.send({
      'status': 400,
      message: "something went wrong in token"
    })

  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        res.send({
          'status': 400,
          Message: "auth token verification failed"
        })
      }

      // let checkUser = await users.findOne({ _id: decoded.teammateId })
      // if (!checkUser) {
      //   res.send({
      //     code: 401,
      //     message: "Please login again1"
      //   })
      //   return
      // }
      // if (!checkUser.status) {
      //   res.send({
      //     code: 401,
      //     message: "Please login again2"
      //   })
      //   return
      // }

      req.userId = decoded.userId;
      req.email = decoded.email;
      req.role = decoded.role;
      req.status = decoded.status;
      next();
    })
  }
};
const authJwt = {
  verifyToken: verifyToken,
};
module.exports = authJwt