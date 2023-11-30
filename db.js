require("dotenv").config();
const mongoose = require('mongoose');

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

const userConnection = makeNewConnection(`${process.env.DB_URL}User`);
const dealerConnection = makeNewConnection(`${process.env.DB_URL}Dealer`);
const serviceConnection = makeNewConnection(`${process.env.DB_URL}ServiceProvider`);
const orderConnection = makeNewConnection(`${process.env.DB_URL}Order`);
const claimConnection = makeNewConnection(`${process.env.DB_URL}Claim`);

module.exports = {
    userConnection,
    dealerConnection,
    serviceConnection,
    orderConnection,
    claimConnection,
};