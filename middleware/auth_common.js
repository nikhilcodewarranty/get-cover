const { verify } = require('crypto');
const jwt = require('jsonwebtoken');
// var config = require('../config/constanct');
require("dotenv").config();


// const config = process.env
 verifyToken = (req,res,next) => {
  let token = req.headers["token"];
  console.log('token------', token)
  if (!token) {
      res.send({
        'status':400,
        message:"something went wrong in token"
      })

  }else{
    // let authentication_code = "abcdefgh1234567"
    if(token == process.env.authentication_code){
      next()
    }
}
};
const authJwtCommon = {
  verifyTokenCommon: verifyToken,
};
module.exports = authJwtCommon