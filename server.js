swaggerUi = require('swagger-ui-express');
swaggerUi1 = require('swagger-ui-express');
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
const userRoutes = require("./User/routes/user");
const dealerRoutes = require("./Dealer/routes/dealer");
const priceRoutes = require("./PriceBook/routes/price");



var app = express();





app.use("/api-v1/api-docs", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocument)(...args));
app.use("/api-v1/priceApi", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocumentDealer)(...args));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// app.use('/api-v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// app.use('/api-v1/dealerApi', swaggerUi1.serve, swaggerUi1.setup(swaggerDocumentDealer));
//app.use('/api/v1', router);
app.use(cors())
const httpServer = http.createServer(app) 
// view engine setup

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//common routing for server
app.use("/api-v1/user", userRoutes);
app.use("/api-v1/dealer", dealerRoutes);
app.use("/api-v1/price", priceRoutes);

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

  // // render the error page
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