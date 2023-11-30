const orderResourceResponse = {};

orderResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
orderResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
orderResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
orderResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
orderResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };

module.exports= orderResourceResponse