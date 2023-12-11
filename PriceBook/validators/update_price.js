const Joi = require('joi')

const update_price_validation = Joi.object({
    name:Joi.string().optional(),
    description:Joi.string().optional(),
    term:Joi.number().optional(),
    frontingFee:Joi.number().optional(),
    reinsuranceFee:Joi.number().optional(),
    adminFee:Joi.number().optional(),
    reserveFutureFee:Joi.number().optional(),
    priceCatId:Joi.string().optional(),
    status: Joi.boolean().optional()
})

module.exports = update_price_validation