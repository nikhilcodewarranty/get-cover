swaggerUi = require('swagger-ui-express');
swaggerDocument = require('./swagger.json');
swaggerDocumentDealer = require('./dealer.json');
const user = require('./User/userServer')
const dealer = require('./Dealer/dealerServer')
require("dotenv").config()
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const http = require('http')
const cors = require('cors')

var app = express();

app.use('/api-v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
//app.use('/api-v1/dealerApi', swaggerUi.serve, swaggerUi.setup(swaggerDocumentDealer));
//app.use('/api/v1', router);
app.use(cors())
const httpServer = http.createServer(app)
// view engine setup

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/uploads/',express.static('./uploads'))


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
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

const PORT = 3000
httpServer.listen(PORT, () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;