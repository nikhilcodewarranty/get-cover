const Joi = require('joi')

const create_price_cat_validation = Joi.object({
    name:Joi.string().required(),
    description:Joi.string().required()
});
module.exports = create_price_cat_validation