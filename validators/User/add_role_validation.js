
const Joi = require('joi')

const add_role_validation = Joi.object({
    role:Joi.string().trim().required()
});
module.exports = add_role_validation