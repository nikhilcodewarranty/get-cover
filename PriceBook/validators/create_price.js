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
    price_type: Joi.string().allow('').optional(),
    startRange: Joi.string().allow('').optional(),
    endRange: Joi.string().allow('').optional(),
    quantityPriceDetail: Joi.array().optional(),
})

module.exports = create_price_validation