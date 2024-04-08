const Joi = require('joi')

const filer_price_book = Joi.object({
    name:Joi.string().trim().allow(null).allow('').optional(),
    category:Joi.string().trim().allow(null).allow('').optional(),
    term:Joi.string().trim().allow(null).allow('').optional(),
    priceType:Joi.string().trim().allow(null).allow('').optional(),
    range:Joi.string().trim().allow(null).allow('').optional(),
    status:Joi.boolean().allow('').optional(),
    dealerId:Joi.string().optional(),
    
})

module.exports = filer_price_book  