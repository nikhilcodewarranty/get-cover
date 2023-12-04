const Joi = require('joi')

const update_price_cat_validation = Joi.object({
    name:Joi.string().required(),
    description:Joi.string().required()
})

module.exports = update_price_cat_validation