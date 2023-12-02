swaggerUi = require('swagger-ui-express');
swaggerDocument = require('./swagger.json');
swaggerDocumentDealer = require('./dealer.json');
const user = require('./User/userServer')
const dealer = require('./Dealer/dealerServer')
const price = require('./PriceBook/priceServer')
require("dotenv").config()
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const http = require('http')
const cors = require('cors')
const createHttpError = require('http-errors')



var app = express();

app.use('/api-v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api-v1/dealerApi', swaggerUi.serve, swaggerUi.setup(swaggerDocumentDealer));
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

app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
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


//* Catch HTTP 404 
app.use((req, res, next) => {
  next(createHttpError(404));
})



const PORT = 3000
httpServer.listen(PORT, () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;