const Joi = require('joi')

const approve_reject_dealer_validation = Joi.object({
    status:Joi.string().valid('Rejected','Approved','Pending').required()
})

module.exports = approve_reject_dealer_validation