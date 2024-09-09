
const Joi = require('joi')

const email_validation = Joi.object({
    email:Joi.string().trim().email().required()
});
module.exports = email_validation