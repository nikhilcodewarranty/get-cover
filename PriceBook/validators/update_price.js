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
    rangeStart: Joi.string().allow('').optional(),
    rangeEnd: Joi.string().allow('').optional(),
    quantityPriceDetail: Joi.array().items(Joi.object().keys({
        name: Joi.string().allow('').optional(),     
        quantity: Joi.string().allow('').optional(),

    })).optional()
})

module.exports = update_price_validation