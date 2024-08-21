const Joi = require('joi')

const change_dealer_status_validation = Joi.object({ 
    status:Joi.boolean().required(),    
})


module.exports = change_dealer_status_validation