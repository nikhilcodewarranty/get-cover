const Joi = require('joi')

const create_price_cat_validation = Joi.object({
    name:Joi.string().trim().required(),
    description:Joi.string().trim().required(),
    coverageType:Joi.string().trim().required(),
    status: Joi.boolean().optional()
});
module.exports = create_price_cat_validation