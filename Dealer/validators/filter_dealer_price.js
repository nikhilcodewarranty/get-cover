const Joi = require('joi')

const filer__dealer_price_book = Joi.object({
    name:Joi.string().trim().allow(null).allow('').optional(),
    term:Joi.string().trim().allow(null).allow('').optional(),
    category:Joi.string().trim().allow(null).allow('').optional(),
    status:Joi.boolean().allow('').optional()
})

module.exports = filer__dealer_price_book  