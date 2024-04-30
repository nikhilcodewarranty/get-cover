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

//db's connection strings
const userConnection = makeNewConnection(`${process.env.DB_URL}getcover`); //getcover_test database 
const dealerConnection = makeNewConnection(`${process.env.DB_URL}getcover`); // dealer database
const serviceConnection = makeNewConnection(`${process.env.DB_URL}getcover`); //service provider database
const orderConnection = makeNewConnection(`${process.env.DB_URL}getcover`); // order database
const claimConnection = makeNewConnection(`${process.env.DB_URL}getcover`); // claim database 
const CustomerConnection = makeNewConnection(`${process.env.DB_URL}getcover`); // claim database 

module.exports = {
    userConnection,
    dealerConnection,
    serviceConnection,
    orderConnection,
    claimConnection,
    CustomerConnection
};