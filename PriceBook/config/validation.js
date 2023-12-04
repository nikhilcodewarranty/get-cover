const createHttpError = require('http-errors') //* middlewares/Validator.js
const Joi = require('joi') //* Include joi to check error type 
const Validators = require('../validators') //* Include all validators

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
            //* Pass err to next
            //! If validation error occurs 
            if (err.isJoi)
                res.send({
                    code: 406,
                    message: err.message.replace(/['"]+/g, '')
                })
        }
    }
}