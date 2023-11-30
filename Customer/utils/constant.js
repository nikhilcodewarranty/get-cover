const customerResourceResponse = {};

customerResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
customerResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
customerResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
customerResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
customerResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };

module.exports=customerResourceResponse