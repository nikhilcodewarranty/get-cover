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


const userConnection = makeNewConnection(`${process.env.DB_URL}` + process.env.dbName); //user database 
const reportingConnection = makeNewConnection(`${process.env.DB_URL}` + process.env.reportingDbName); // reporting database 

module.exports = {
    userConnection,
    reportingConnection
};