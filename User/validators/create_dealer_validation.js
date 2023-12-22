const Joi = require('joi')

const create_dealer_validation = Joi.object({
      dealers: Joi.array().items(Joi.object().keys({
        email: Joi.string().trim().required(),
        firstName: Joi.string().trim().required(),
        lastName: Joi.string().trim().required(),
        phoneNumber: Joi.number().required(),
        isPrimary: Joi.boolean().required(),
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each dealer's email must be unique."),
  
    priceBook: Joi.array().items(Joi.object().keys({
        priceBookId: Joi.string().trim().required(),
        retailPrice: Joi.number().required(),
        wholesalePrice: Joi.number().required(),
    }).unknown(true)).unique((a, b) => a.priceBookId === b.priceBookId).message("Each dealer's price must be unique."),


    name: Joi.string().trim().required(),
    street: Joi.string().trim().required(),
    city: Joi.string().trim().required(),
    email: Joi.string().trim().required(),
    firstName: Joi.string().trim().required(),
    lastName: Joi.string().trim().required(),
    zip: Joi.number().required(),
    phoneNumber: Joi.number().required(),
    state: Joi.string().trim().required(),
    country: Joi.string().trim().required(),
    createdBy: Joi.string().trim().optional(),
    role: Joi.string().trim().required(),
    isAccountCreate: Joi.boolean().required(),
    dealerId: Joi.string().trim().optional(),
    savePriceBookType:Joi.string().trim().required(),
    customerAccountCreated: Joi.boolean().required(),

});
module.exports = create_dealer_validation