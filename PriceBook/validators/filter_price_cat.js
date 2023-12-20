const Joi = require('joi')

const filer_price_book = Joi.object({
    name:Joi.string().trim().allow(null).allow('').optional(),
    status:Joi.bolean().allow('').optional(),
    
})

module.exports = filer_price_cat