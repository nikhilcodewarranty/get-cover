const Joi = require('joi')

const update_dealer_price_validation = Joi.object({
    brokerFee:Joi.number().optional().allow(),
    status:Joi.boolean().optional().allow(),
    retailPrice:Joi.number().optional().allow(),
    priceBook:Joi.string().optional().allow(),
})

module.exports = update_dealer_price_validation