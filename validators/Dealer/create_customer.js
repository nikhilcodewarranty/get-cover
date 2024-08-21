const Joi = require('joi')

const create_customer_validation = Joi.object({
    accountName: Joi.string().trim().replace(/\s+/g, ' ').required(),
    resellerName:Joi.string().allow('').optional(),
    status: Joi.boolean().required(),
    street: Joi.string().trim().replace(/\s+/g, ' ').required().messages({'string.base': `"a" should be a type of 'text'`,
    'string.empty': `Customer street address not allowed to be empty `}),
    city: Joi.string().trim().replace(/\s+/g, ' ').required(),
    zip: Joi.number().required(),
    state: Joi.string().trim().replace(/\s+/g, ' ').required(),
    country: Joi.string().trim().replace(/\s+/g, ' ').required(),
    email: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    firstName: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    lastName: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    phoneNumber: Joi.number().optional(),
    isPrimary: Joi.boolean().optional(),
    status: Joi.boolean().optional(),
    position: Joi.string().trim().allow('').replace(/\s+/g, ' ').optional(),
    members: Joi.array().items(Joi.object().keys({
        email: Joi.string().replace(/\s+/g, ' ').trim().required(),
        firstName: Joi.string().replace(/\s+/g, ' ').trim().required(),
        lastName: Joi.string().replace(/\s+/g, ' ').trim().required(),
        phoneNumber: Joi.number().required(),
        isPrimary: Joi.boolean().required(),
        status: Joi.boolean().required(),
        position: Joi.string().trim().allow('').replace(/\s+/g, ' ').optional()
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each customer's email must be unique."),
})


module.exports = create_customer_validation

