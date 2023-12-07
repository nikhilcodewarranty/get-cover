const Joi = require('joi');

const loginValidation = Joi.object({
    email: Joi.string().email().pattern(new RegExp('^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,50}$', 'i')).required(),
    password: Joi.string().required()
});

module.exports = loginValidation;
