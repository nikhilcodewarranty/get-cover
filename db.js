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
const userConnection = makeNewConnection(`${process.env.DB_URL}User`); //user database 
const dealerConnection = makeNewConnection(`${process.env.DB_URL}User`); // dealer database
const serviceConnection = makeNewConnection(`${process.env.DB_URL}User`); //service provider database
const orderConnection = makeNewConnection(`${process.env.DB_URL}User`); // order database
const claimConnection = makeNewConnection(`${process.env.DB_URL}User`); // claim database 
const CustomerConnection = makeNewConnection(`${process.env.DB_URL}User`); // claim database 

module.exports = {
    userConnection,
    dealerConnection,
    serviceConnection,
    orderConnection,
    claimConnection,
    CustomerConnection
};