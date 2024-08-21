const Joi = require('joi')

const create_dealer_price_book_validation = Joi.object({
    dealerId:Joi.string().trim().hex().length(24),
    priceBook:Joi.string().trim().hex().length(24),
    retailPrice:Joi.number().required(),
    status:Joi.boolean().required(),
    brokerFee:Joi.number().required(),
    wholesalePrice:Joi.number().optional(),
    term:Joi.string().optional(),
    categoryId:Joi.string().optional(),
    priceType:Joi.string().allow('').optional(),
    brokerFee:Joi.number().required(),
    description:Joi.string().allow('').optional(),
    
})


module.exports = create_dealer_price_book_validation