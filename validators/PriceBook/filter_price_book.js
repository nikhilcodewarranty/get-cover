const Joi = require('joi')

const filer_price_book = Joi.object({
    name: Joi.string().trim().allow(null).allow('').optional(),
    coverageType: Joi.string().trim().allow(null).allow('').optional(),
    pName: Joi.string().trim().allow(null).allow('').optional(),
    priceType: Joi.string().trim().allow(null).allow('').optional(),
    term: Joi.string().trim().allow(null).allow('').optional(),
    range: Joi.string().trim().allow(null).allow('').optional(),
    category: Joi.string().trim().allow(null).allow('').optional(),
    status: Joi.boolean().allow('').optional(),
    dealerSku: Joi.string().trim().allow('').optional(),
    dealerId: Joi.string().trim().allow('').optional(),

})

module.exports = filer_price_book  