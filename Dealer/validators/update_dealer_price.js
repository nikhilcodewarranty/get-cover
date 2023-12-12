const Joi = require('joi')

const update_dealer_price_validation = Joi.object({
    brokerFee:Joi.number().optional().allow(),
    status:Joi.boolean().optional().allow(),
})

module.exports = update_dealer_price_validation