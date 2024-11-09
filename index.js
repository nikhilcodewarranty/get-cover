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
const dealerRoutes = require('./routes/Dealer/dealer');
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
const { IpFilter, IpDeniedError } = require('express-ipfilter');
const axios = require('axios');
const mongoose = require('mongoose')
const fs = require('fs');
const { verifyToken } = require('./middleware/auth') // authentication with jwt as middleware
var app = express();
// const htmlPage = require("./test.html")

app.use("/api-v1/api-docs", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocument)(...args));
app.use("/api-v1/priceApi", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocumentDealer)(...args));
app.set('view engine', 'pug');

app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/uploads', express.static('./uploads/'))
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});


app.use((req, res, next) => {
  const ip = req.ip;
  next();
});


// List of allowed IPs
console.log("sdfsdfsdfsdsdf")
function isHostAllowed(req) {
  const allowedHosts = [process.env.firstOrigin, process.env.secondOrigin, process.env.thirdOrigin, process.env.localOrigin, process.env.imageOrigin]; // Add your allowed origin here
  const host = req.headers.origin;
  return allowedHosts.includes(host);
}

// app.use((req, res, next) => {
//   if (req.headers.host == "localhost:3002" || req.headers.host == "http://54.176.118.28:3002") {
//     next(); // Proceed if the host is allowed
//   } else {
//     if (isHostAllowed(req)) {
//       next(); // Proceed if the host is allowed
//     } else {
//       console.log("checking the origin ++++++++++++++++++++++++++++++++++++++++++", allowedHosts, req.headers)
//       res.status(403).send('Access denied: Host not allowed');
//     }
//   }
// });


app.use(cors())
app.set('trust proxy', true);
// app.use(IpFilter(allowedIps, { mode: 'allow' }));
const httpServer = http.createServer(app)

// view engine setup  
app.use(logger('dev'));
app.use(express.json());
app.use(trim_all);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



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

cron.schedule('25 * * * * *', () => {
  console.log("Hello I am")
  axios.get(`https://api.demo.codewarranty.com/api-v1/claim/statusClaim`)   //live
});


//common routing for server
app.use("/api-v1/user", userRoutes);
// app.use("/", htmlPage);
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
  res.send({
    code: 404,
    message: "Not Found"
  })

})
const PORT = 3002



httpServer.listen(PORT, '0.0.0.0', () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;