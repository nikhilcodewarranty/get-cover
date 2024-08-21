const Joi = require('joi')

const filer_dealer = Joi.object({
    name:Joi.string().trim().allow(null).allow('').optional(),
    email:Joi.string().trim().allow(null).allow('').optional(),
    phoneNumber:Joi.number().allow(null).allow('').optional(),
    
})

module.exports = filer_dealer   