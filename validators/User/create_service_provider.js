const Joi = require('joi')

const create_service_provider_validation = Joi.object({
    providers: Joi.array().items(Joi.object().keys({
        email: Joi.string().trim().email().required(),
        password: Joi.string().trim().required(),
        firstName: Joi.string().trim().required(),
        lastName: Joi.string().trim().required(),
        phoneNumber: Joi.number().min(5).max(16).required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each provider's email must be unique."),
    name: Joi.string().trim().required(),
    street: Joi.string().trim().required(),
    city: Joi.string().trim().required(),
    zip: Joi.number().required(),
    state: Joi.string().trim().required(),
    country: Joi.string().trim().required(),
    createdBy: Joi.string().trim().optional(),
    role: Joi.string().trim().required(),
    customerAccountCreated: Joi.boolean().required(),
    
});

module.exports = create_service_provider_validation