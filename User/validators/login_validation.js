const Joi = require('joi')

const login_validation = Joi.object({
    email:Joi.string().email().required(),
    password:Joi.string().required()
});
module.exports = login_validation