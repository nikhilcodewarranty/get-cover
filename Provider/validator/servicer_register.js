const Joi = require('joi')

const register_servicer_validation = Joi.object({
    name:Joi.string().trim().min(3).required(),
    street:Joi.string().trim().required(),
    city:Joi.string().trim().required(),
    zip:Joi.number().required(),
    state:Joi.string().trim().required(),
    country:Joi.string().trim().required(),
    email:Joi.string().trim().email().required(),
    firstName:Joi.string().trim().required(),
    lastName:Joi.string().trim().required(),
    phoneNumber:Joi.number().required(),
    role:Joi.string().trim().required(),
})

module.exports = register_servicer_validation