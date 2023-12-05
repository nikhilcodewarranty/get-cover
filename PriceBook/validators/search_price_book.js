const Joi = require('joi')

const search_price_book = Joi.object({
    name:Joi.string().allow(null).allow('').optional(),
    description:Joi.string().allow(null).allow('').optional(),
    state:Joi.string().allow(null).allow('').optional(),
    zip:Joi.string().allow(null).allow('').optional(),
    city:Joi.string().allow(null).allow('').optional(),
})

module.exports = search_price_book