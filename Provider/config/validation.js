const createHttpError = require('http-errors') //* middlewares/Validator.js
const Joi = require('joi') //* Include joi to check error type 
const Validators = require('../validator') //* Include all validators
const constant = require('../../config/constant')

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
                    code: constant.validationError,
                    message: err.message.replace(/['"]+/g, '')
                })
        }
    }
}