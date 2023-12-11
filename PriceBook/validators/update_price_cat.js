const Joi = require('joi')

const update_price_cat_validation = Joi.object({
    name:Joi.string().required(),
    description:Joi.string().required(),
    status: Joi.boolean().optional()
})

module.exports = update_price_cat_validation