const Joi = require('joi')

const login_validation = Joi.object({
    email:Joi.string().email().required(),
    password:Joi.string().email().required()
});
module.exports = login_validation