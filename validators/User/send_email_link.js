const Joi = require('joi')

const send_email_link_validation = Joi.object({
    email:Joi.string().trim().email().required()
})

module.exports = send_email_link_validation