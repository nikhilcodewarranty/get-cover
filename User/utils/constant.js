const userResourceResponse = {};

userResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
userResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
userResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
userResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
userResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };