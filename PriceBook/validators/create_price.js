const Joi = require('joi')
const create_price_validation = Joi.object({
    name:Joi.string().trim().required(),
    description:Joi.string().trim().required(),
    term:Joi.number().required(),
    frontingFee:Joi.number().required(),
    reinsuranceFee:Joi.number().required(),
    adminFee:Joi.number().required(),
    reserveFutureFee:Joi.number().required(),
    priceCatId:Joi.string().trim().required(),
    status: Joi.boolean().optional(),
    priceType: Joi.string().allow('').optional(),
    rangeStart: Joi.number().optional(),
    rangeEnd: Joi.number().optional().greater(Joi.ref('rangeStart')),
    quantityPriceDetail: Joi.array().items(Joi.object().keys({
        name: Joi.string().allow('').optional(),     
        quantity: Joi.string().allow('').optional(),

    })).optional()
})

module.exports = create_price_validation