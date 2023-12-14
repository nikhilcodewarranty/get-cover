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
    status: Joi.boolean().optional()
})

module.exports = create_price_validation