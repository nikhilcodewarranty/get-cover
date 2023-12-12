const Joi = require('joi')

const update_price_validation = Joi.object({
    name:Joi.string().optional().allow(),
    description:Joi.string().optional().allow(),
    frontingFee:Joi.number().optional().allow(),
    reinsuranceFee:Joi.number().optional().allow(),
    adminFee:Joi.number().optional().allow(),
    reserveFutureFee:Joi.number().optional().allow(),
    category:Joi.string().optional().allow(),
    status: Joi.boolean().optional().allow()
})

module.exports = update_price_validation