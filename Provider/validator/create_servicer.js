const Joi = require("joi")

const removeSpacesBetween = (value, helpers) => {
    const cleanedValue = value.replace(/\s+/g, ''); // Replace all spaces with an empty string
    return cleanedValue;
  };

const create_servicer_validation = Joi.object({
    accountName:Joi.string().trim().alter({
        removeSpaces: (schema) => schema.custom(removeSpacesBetween),
      }).required()
})