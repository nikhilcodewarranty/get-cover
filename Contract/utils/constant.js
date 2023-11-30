const contractResourceResponse = {};

contractResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
contractResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
contractResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
contractResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
contractResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };

module.exports=contractResourceResponse