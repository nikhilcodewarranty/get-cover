const Joi = require('joi');

const loginValidation = Joi.object({
    email:Joi.string().email({ tlds: { allow: false } }),
    password: Joi.string().required()
});

module.exports = loginValidation;
