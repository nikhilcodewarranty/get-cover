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

// const { databaseConnect } = require("./db");
const userRoutes = require("./routes/user");

console.log('user server++++++++++++++++++')

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

app.use("/api-v1", userRoutes);
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

app.set('views', path.join(__dirname, 'views'));

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  //  render the error page
  res.status(err.status || 500);
  res.render('error');
});

//* Catch HTTP 404 
app.use((req, res, next) => {
  next(createHttpError(404));
})



console.log('check+++++++++++++++++222222')

const PORT = process.env.USER_API_ENDPOINT || 8080
httpServer.listen(PORT, () => console.log(`users Server is running on port ${PORT}`))

module.exports = app;