const priceResourceResponse = {};

priceResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
priceResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
priceResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
priceResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
priceResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };