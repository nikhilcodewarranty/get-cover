
const Joi = require('joi')

const add_role_validation = Joi.object({
    role:Joi.string().min(3).max(20).required()
});
module.exports = add_role_validation