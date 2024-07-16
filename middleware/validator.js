//* middlewares/Validator.js
const createHttpError = require('http-errors')
//* Include joi to check error type 
const Joi = require('joi')
//* Include all validators
const Validators = require('../User/validators')

module.exports = function (validator) {
    //! If validator is not exist, throw err
    if (!Validators.hasOwnProperty(validator))
        throw new Error(`'${validator}' validator is not exist`)

    return async function (req, res, next) {
        try {
            const validated = await Validators[validator].validateAsync(req.body)
            req.body = validated
            next()
        } catch (err) {
            if (err.isJoi)
                res.send({
                    code: 406,
                    message: err.message.replace(/['"]+/g, '')
                })
        }
    }
}