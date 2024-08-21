const Joi = require('joi');

const loginValidation = Joi.object({
    email:Joi.string().trim().email({ tlds: { allow: false } }),
    password: Joi.string().trim().required()
});

module.exports = loginValidation;
