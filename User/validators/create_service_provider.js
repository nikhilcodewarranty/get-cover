const Joi = require('joi')

const create_service_provider_validation = Joi.object({
    providers: Joi.array().items(Joi.object().keys({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.string().min(5).max(16).required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each provider's email must be unique."),
    name: Joi.string().required(),
    street: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    createdBy: Joi.string().optional(),
    role: Joi.string().required(),
    customerAccountCreated: Joi.boolean().required(),
    
});

module.exports = create_service_provider_validation