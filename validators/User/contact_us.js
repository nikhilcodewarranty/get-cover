const Joi = require('joi')

const filer_contact_us = Joi.object({
    firstName:Joi.string().trim().allow(null).allow('').optional(),
    phoneNumber:Joi.string().trim().allow(null).allow('').optional(),
    lastName:Joi.string().trim().allow(null).allow('').optional(),
    email:Joi.string().allow(null).allow('').optional(),
    description:Joi.string().allow(null).allow('').optional(),    
    category:Joi.string().allow(null).allow('').optional(),    
    siteURL:Joi.string().allow(null).allow('').optional(),    
    location:Joi.string().allow(null).allow('').optional(),    
    ipAddress:Joi.string().allow(null).allow('').optional(),    
    
})

module.exports = filer_contact_us   