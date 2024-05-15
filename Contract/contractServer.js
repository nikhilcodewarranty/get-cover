// app.js
require("dotenv").config();
const express = require("express");
var createError = require('http-errors');
const bodyParser = require("body-parser");
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const http = require('http')
const cors = require('cors')
var path = require('path');
const createHttpError = require('http-errors')

const { databaseConnect } = require("./db");
const contractRoutes = require("./routes/contract");

var app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())
const httpServer = http.createServer(app)
// view engine setup
app.use((request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use("/api-v1", contractRoutes);
// app.set("views", path.join(__dirname, "views"))
// app.set("view engine", "pug")
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/', express.static('./uploads'))

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.redirect("http://15.207.221.207/")
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//* Catch HTTP 404 
app.use((req, res, next) => {
  next(createHttpError(404));
})

const PORT =  8087
httpServer.listen(PORT, () => console.log(`Contract server is running on port ${PORT}`))

module.exports = app;


































// // app.js
// const express = require('express');
// const mongoose = require("mongodb").MongoClient;
// const bodyParser = require('body-parser');
// require('dotenv').config();
// const app = express();
// const port = process.env.BOOKS_API_PORT || 8086;
// const {databaseConnect} = require('./db')

// const orderRoutes = require('./routes/order');

// app.use('/api/v1', orderRoutes);



// app.use(bodyParser.json());



// app.listen(port, () => {
//   console.log(`Order server is running on port ${port}`);
// });