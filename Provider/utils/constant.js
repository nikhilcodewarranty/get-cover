const serviceResourceResponse = {};

serviceResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
serviceResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
serviceResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
serviceResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
serviceResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };

module.exports= serviceResourceResponse