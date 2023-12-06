const Joi = require('joi')

const create_service_provider_validation = Joi.object({
    email:Joi.string().email().required(),
    password:Joi.string().required(),
    firstName:Joi.string().required(),
    lastName:Joi.string().required(),
    phoneNumber:Joi.string().min(5).max(16).required(),
    isPrimary:Joi.boolean().required(),
    name:Joi.string().required(),
    street:Joi.string().required(),
    city:Joi.string().required(),
    zip:Joi.string().required(),
    state:Joi.string().required(),
    country:Joi.string().required(),
    createdBy:Joi.string().optional(),
    role:Joi.string().required(),
})

module.exports = create_service_provider_validation