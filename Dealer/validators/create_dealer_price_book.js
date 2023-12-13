const Joi = require('joi')

const create_dealer_price_book_validation = Joi.object({
    dealerId:Joi.string().hex().length(24),
    priceBook:Joi.string().hex().length(24),
    retailPrice:Joi.number().min(1).max(10).required(),
    status:Joi.boolean().required()
})


module.exports = create_dealer_price_book_validation