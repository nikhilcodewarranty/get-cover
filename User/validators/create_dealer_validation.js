const Joi = require('joi')

const create_dealer_validation = Joi.object({
    dealers: Joi.array().items(Joi.object().keys({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.string().min(5).max(16).required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each dealer's email must be unique."),

    priceBook: Joi.array().items(Joi.object().keys({
        priceBook: Joi.string().required(),
        dealerId: Joi.string().required(),
        brokerFee: Joi.string().required()
    }).unknown(true)).unique((a, b) => a.priceBook === b.priceBook).message("Each dealer's price must be unique."),


    name: Joi.string().required(),
    street: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    createdBy: Joi.string().optional(),
    role: Joi.string().required(),
});
module.exports = create_dealer_validation