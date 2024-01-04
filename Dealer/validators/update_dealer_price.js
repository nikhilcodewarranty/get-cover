const Joi = require('joi')

const update_dealer_price_validation = Joi.object({
    dealerId:Joi.string().trim().hex().length(24),
    priceBook:Joi.string().trim().hex().length(24),
    retailPrice:Joi.number().optional(),
    status:Joi.boolean().optional(),
    brokerFee:Joi.number().optional(),
    wholesalePrice:Joi.number().optional(),
    term:Joi.number().optional(),
    description:Joi.string().allow('').optional(),
    categoryId:Joi.string().optional()
})

module.exports = update_dealer_price_validation