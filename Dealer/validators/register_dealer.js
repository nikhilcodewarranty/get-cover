const Joi = require('joi')

const register_dealer_validation = Joi.object({
    name:Joi.string().min(3).required(),
    street:Joi.string().required(),
    city:Joi.string().required(),
    zip:Joi.number().required(),
    state:Joi.string().required(),
    country:Joi.string().required(),
    email:Joi.string().email().required(),
    firstName:Joi.string().required(),
    lastName:Joi.string().required(),
    phoneNumber:Joi.number().required(),
    role:Joi.string().required(),
})

module.exports = register_dealer_validation