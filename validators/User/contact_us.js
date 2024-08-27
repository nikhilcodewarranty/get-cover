const Joi = require('joi')

const filer_dealer = Joi.object({
    firstName:Joi.string().trim().allow(null).allow('').optional(),
    lastName:Joi.string().trim().allow(null).allow('').optional(),
    email:Joi.string().allow(null).allow('').optional(),
    
})

module.exports = filer_dealer   