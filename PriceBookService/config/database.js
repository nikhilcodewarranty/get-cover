module.exports = { 
  usersMongoURI: `mongodb://localhost:27017/${process.env.USERS_API_DATABASE_NAME}`,
  dealersMongoURI: `mongodb://localhost/${process.env.DEALERS_API_DATABASE_NAME}`,
  serviceMongoURI: `mongodb://localhost/${process.env.SERVICE_PROV_API_DATABASE_NAME}`,
  customerMongoURI: `mongodb://localhost/${process.env.CUSTOMERS_API_DATABASE_NAME}`,
  priceMongoURI: `mongodb://localhost/${process.env.PRICE_BOOK_API_DATABASE_NAME}`
};