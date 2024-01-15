const Joi = require('joi')

const update_price_validation = Joi.object({
    name:Joi.string().trim().optional().allow(),
    description:Joi.string().trim().optional().allow(),
    frontingFee:Joi.number().optional().allow(),
    reinsuranceFee:Joi.number().optional().allow(),
    adminFee:Joi.number().optional().allow(),
    reserveFutureFee:Joi.number().optional().allow(),
    priceCatId:Joi.string().trim().optional().allow(),
    status: Joi.boolean().optional().allow(),
    priceType: Joi.string().allow('').optional(),
    startRange: Joi.string().allow('').optional(),
    endRange: Joi.string().allow('').optional(),
    quantityPriceDetail: Joi.array().allow([]).optional(),
})

module.exports = update_price_validation