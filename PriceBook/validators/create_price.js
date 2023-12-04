const Joi = require('joi')
const create_price_validation = Joi.object({
    name:Joi.string().required(),
    description:Joi.string().required(),
    term:Joi.number().required(),
    frontingFee:Joi.number().required(),
    reinsuranceFee:Joi.number().required(),
    adminFee:Joi.number().required(),
    reserveFutureFee:Joi.number().required(),
    priceCatId:Joi.string().required()
})

module.exports = create_price_validation