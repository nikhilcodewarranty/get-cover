const customResourceResponse = {};

claimResourceResponse.success = { statusCode: 200, message: 'Request has been processed successfully.' };
claimResourceResponse.reqCreated = { statusCode: 201, message: 'Record has been created successfully.' };
claimResourceResponse.recordNotFound = { statusCode: 404, message: 'No record found.' };
claimResourceResponse.serverError = { statusCode: 500, message: 'Internal server error.' };
claimResourceResponse.reqValidationError = { statusCode: 422, message: 'Data validation failed.' };