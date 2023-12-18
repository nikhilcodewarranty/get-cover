const Joi = require('joi')

const create_dealer_validation = Joi.object({
    dealers: Joi.array().items(Joi.object().keys({
        email: Joi.string().trim().email().required(),
        firstName: Joi.string().trim().required(),
        lastName: Joi.string().trim().required(),
        phoneNumber: Joi.number().required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each dealer's email must be unique.").optional(),
    priceBook: Joi.array().items(Joi.object().keys({
        priceBook: Joi.string().trim().required(),
        retailPrice: Joi.number().required(),
        wholePrice: Joi.number().required(),
    }).unknown(true)).unique((a, b) => a.priceBook === b.priceBook).message("Each dealer's price must be unique."),
    dealerId: Joi.string().trim().required(),
    flag: Joi.string().trim().required(),
    createdBy: Joi.string().trim().optional(),
    role: Joi.string().trim().required(),
    isAccountCreate: Joi.boolean().required(),
    savePriceBookType:Joi.string().trim().required(),
    customerAccountCreated: Joi.boolean().required(),

});
module.exports = create_dealer_validation