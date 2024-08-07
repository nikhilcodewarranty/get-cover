require("dotenv").config();
const mongoose = require('mongoose');

// db connection function
const makeNewConnection = (uri) => {
    const db = mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    db.on('error', function (error) {
        console.log(`MongoDB :: connection ${this.name} ${JSON.stringify(error)}`);
        db.close().catch(() => console.log(`MongoDB :: failed to close connection ${this.name}`));
    });

    db.on('connected', function () {
        console.log(`MongoDB :: connected ${this.name}`);
    });

    db.on('disconnected', function () {
        console.log(`MongoDB :: disconnected ${this.name}`);
    });

    return db;
}

// //db's connection strings
// const userConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); //getcover_test database 
// const userConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); // dealer database
// const userConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); //service provider database
// const orderConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); // order database
// const claimConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); // claim database 
// const CustomerConnection = makeNewConnection(`${process.env.DB_URL}getcover_test`); // claim database 

const userConnection = makeNewConnection(`${process.env.DB_URL}` + process.env.dbName); //user database 
const reportingConnection = makeNewConnection(`${process.env.DB_URL}` + process.env.reportingDbName); // reporting database 

module.exports = {
    userConnection,
    reportingConnection
};