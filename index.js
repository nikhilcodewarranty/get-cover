require("dotenv").config()
var express = require('express');
const pdf = require('pdf-creator-node');

var path = require('path');
var logger = require('morgan');
const { trim_all } = require('request_trimmer');

var cookieParser = require('cookie-parser');
const cors = require('cors')
var bodyParser = require("body-parser");
const http = require('http')
const createHttpError = require('http-errors')
var createError = require('http-errors');
swaggerUi = require('swagger-ui-express');
swaggerUi1 = require('swagger-ui-express');
// required files 
swaggerDocument = require('./swagger.json');
swaggerDocumentDealer = require('./dealer.json');
const userRoutes = require('./routes/User/user');
const reportingRoutes = require("./routes/User/reporting");
const dealerRoutes =  require('./routes/Dealer/dealer');
const dealerUserRoutes = require("./routes/Dealer/dealerUser");
const resellerRoutes = require("./routes/Dealer/reseller");
const resellerUserRoutes = require("./routes/Dealer/resellerUser");
const claimRoutes = require("./routes/Claim/claim");
const contractRoutes = require("./routes/Contracts/contract");
const serviceRoutes = require("./routes/Provider/service");
const servicePortal = require("./routes/Provider/servicerUserRoute");
const orderRoutes = require("./routes/Order/order");
const priceRoutes = require("./routes/PriceBook/price");
const customerRoutes = require("./routes/Customer/customer");
const customerUserRoutes = require("./routes/Customer/customerUser");
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const mongoose = require('mongoose')
const fs = require('fs');
const { verifyToken } = require('./middleware/auth') // authentication with jwt as middleware
var app = express();

const allowedIP = '15.207.221.207';
// Middleware to check IP address
app.use((req, res, next) => {
  const requestIP = req.ip;
  console.log("system ip--------------",requestIP)
  if (requestIP === allowedIP) {
    next(); // Allow the request to proceed
  } else {
    res.send('Access denied. Your IP is not allowed.');
  }
});

app.use("/api-v1/api-docs", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocument)(...args));
app.use("/api-v1/priceApi", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocumentDealer)(...args));

app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors())
const httpServer = http.createServer(app)

// view engine setup  
app.use(logger('dev'));
app.use(express.json());
app.use(trim_all);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static('./uploads/'))

app.get('/download/:filename', (req, res) => {
  const filePath = __dirname + '/uploads/' + process.env.DUMMY_CSV_FILE;

  res.setHeader('Content-Disposition', 'attachment; filename=' + process.env.DUMMY_CSV_FILE);
  res.download(filePath, process.env.DUMMY_CSV_FILE);
});


var cron = require('node-cron');
var cronOptions = {
  'method': 'POST',
  'url': `${process.env.API_ENDPOINT}api-v1/order/cronJobStatus`,
};

cron.schedule(' 2 0 * * *', () => {
  axios.get(`${process.env.API_ENDPOINT}api-v1/order/cronJobStatus`)   //live
});
cron.schedule(' 4 0 * * *', () => {
  axios.get(`${process.env.API_ENDPOINT}api-v1/contract/cronJobEligible`)   //live
});

cron.schedule(' 6 0 * * *', () => {
  axios.get(`${process.env.API_ENDPOINT}api-v1/claim/statusClaim`)   //live
});
//common routing for server
app.use("/api-v1/user", userRoutes);
app.use("/api-v1/reporting", reportingRoutes);
app.use("/api-v1/admin", userRoutes);
app.use("/api-v1/dealer", dealerRoutes);
app.use("/api-v1/reseller", resellerRoutes);

app.use("/api-v1/contract", contractRoutes);
app.use("/api-v1/servicer", serviceRoutes);
app.use("/api-v1/price", priceRoutes);
app.use("/api-v1/order", orderRoutes);
app.use("/api-v1/customer", customerRoutes);
app.use("/api-v1/claim", claimRoutes);

app.use("/api-v1/servicerPortal", servicePortal);
app.use("/api-v1/dealerPortal", dealerUserRoutes);
app.use("/api-v1/customerPortal", customerUserRoutes);
app.use("/api-v1/resellerPortal", resellerUserRoutes);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.redirect(process.env.SITE_URL)

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
  res.redirect(process.env.SITE_URL)


})
const PORT = 3002



httpServer.listen(PORT, () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;