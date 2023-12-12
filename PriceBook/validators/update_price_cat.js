const Joi = require('joi')

const update_price_cat_validation = Joi.object({
    name:Joi.string().optional().allow(),
    description:Joi.string().optional().allow(),
    status: Joi.boolean().optional().allow()
})

module.exports = update_price_cat_validation