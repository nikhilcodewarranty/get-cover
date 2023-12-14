const Joi = require('joi')

const search_price_cat = Joi.object({
    name:Joi.string().trim().allow(null).allow('').optional()
})

module.exports = search_price_cat