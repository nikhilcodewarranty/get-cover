const Joi = require('joi')

const create_dealer_validation = Joi.object({
    dealers: Joi.array().items(Joi.object().keys({
        email: Joi.string().email().required(),
        password: Joi.string().optional().allow(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.number().required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each dealer's email must be unique.").optional(),
    dealerPrimary: Joi.array().items(Joi.object().keys({
        email: Joi.string().email().required(),
        password: Joi.string().optional().allow(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.number().required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).required(),

    priceBook: Joi.array().items(Joi.object().keys({
        priceBook: Joi.string().required(),
        brokerFee: Joi.number().required()
    }).unknown(true)).unique((a, b) => a.priceBook === b.priceBook).message("Each dealer's price must be unique."),


    name: Joi.string().required(),
    street: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.number().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    createdBy: Joi.string().optional(),
    role: Joi.string().required(),
    isAccountCreate: Joi.boolean().required(),
    customerAccountCreated: Joi.boolean().required(),
    
});
module.exports = create_dealer_validation