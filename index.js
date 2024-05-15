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
const user = require('./User/userServer')
const service = require('./Provider/serviceServer')
const customer = require('./Customer/customerServer')
const claimServer = require('./Claim/claimServer')
const dealer = require('./Dealer/dealerServer')
const contract = require('./Contract/contractServer')
const order = require('./Order/orderServer')
const price = require('./PriceBook/priceServer')
const userRoutes = require("./User/routes/user");
const dealerRoutes = require("./Dealer/routes/dealer");
const dealerUserRoutes = require("./Dealer/routes/dealerUser");
const resellerRoutes = require("./Dealer/routes/reseller");
const resellerUserRoutes = require("./Dealer/routes/resellerUser");
const claimRoutes = require("./Claim/routes/claim");
const contractRoutes = require("./Contract/routes/contract");
const serviceRoutes = require("./Provider/routes/service");
const servicePortal = require("./Provider/routes/servicerUserRoute");
const orderRoutes = require("./Order/routes/order");
const priceRoutes = require("./PriceBook/routes/price");
const customerRoutes = require("./Customer/routes/customer");
const customerUserRoutes = require("./Customer/routes/customerUser");
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const mongoose = require('mongoose')
const fs = require('fs');
const { verifyToken } = require('./middleware/auth') // authentication with jwt as middleware
var app = express();
// mongoose.Promise = global.Promise;

// // Connecting to the database
// mongoose.connect("mongodb://localhost:27017/getCover", {
//   useNewUrlParser: true,
//   // useUnifiedTopology: true,
//   // useFindAndModify: false
// }).then(() => {
//   console.log("Successfully connected to the database");
// }).catch(err => {
//   console.log('Could not connect to the database. Exiting now...', err);
//   process.exit();
// });
app.use("/api-v1/api-docs", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocument)(...args));
app.use("/api-v1/priceApi", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocumentDealer)(...args));
//const template = fs.readFileSync('./template/template.html', 'utf-8')
// const options = {
//   format: 'A4',
//   orientation: 'portrait',
//   border: '10mm',
//   childProcessOptions: {
//     env: {
//       OPENSSL_CONF: '/dev/null',
//     },
//   }
// }
// const document = {
//   html: template,
//   data: {
//     message: 'My First PDF'
//   },
//   path: "./pdfs/teste33r.pdf"
// }

// pdf.create(document,options).then((res)=>{
// console.log(res)
// })

//proxy servers
// app.use('/user', createProxyMiddleware({ target: 'http://localhost:8080/', changeOrigin: true, pathRewrite: { '^/user': '/' }}));
// app.use('/dealer', createProxyMiddleware({ target: 'http://localhost:8082/', changeOrigin: true, pathRewrite: { '^/dealer': '/' }}));
// app.use('/price', createProxyMiddleware({ target: 'http://localhost:8083/', changeOrigin: true, pathRewrite: { '^/price': '/' }}));
// app.use('/servicer', createProxyMiddleware({ target: 'http://localhost:8084/', changeOrigin: true, pathRewrite: { '^/servicer': '/' }}));
//app.use('/customer', createProxyMiddleware({ target: 'http://localhost:8085/', changeOrigin: true, pathRewrite: { '^/customer': '/' } }));

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

app.use('/uploads', [verifyToken], express.static('./uploads/'))
// app.use('/uploads/resultFile', express.static('./uploads/resultFile/'))

app.get('/download/:filename', (req, res) => {
  const filePath = __dirname + '/uploads/' + process.env.DUMMY_CSV_FILE;

  res.setHeader('Content-Disposition', 'attachment; filename=' + process.env.DUMMY_CSV_FILE);
  res.download(filePath, process.env.DUMMY_CSV_FILE);
});


var cron = require('node-cron');
var cronOptions = {
  'method': 'POST',
  'url': `${process.env.SITE_URL}:3002/api-v1/order/cronJobStatus`,
};

// var job =  cron.schedule('* * * * * *', function() {    //* * * * * *
//   axios
//   .post("http://15.207.221.207:3002/api-v1/order/cronJobStatus", {}) 
// }, null, true, 'America/Los_Angeles');



cron.schedule(' 2 0 * * *', () => {
  axios.get(`${process.env.SITE_URL}:3002/api-v1/order/cronJobStatus`)   //live
  // axios.get("http://localhost:3002/api-v1/order/cronJobStatus")   // local 
});
cron.schedule(' 4 0 * * *', () => {
  axios.get(`${process.env.SITE_URL}:3002/api-v1/contract/cronJobEligible`)   //live
  // axios.get("http://localhost:3002/api-v1/order/cronJobStatus")   // local 
});

cron.schedule(' 6 0 * * *', () => {
  axios.get(`${process.env.SITE_URL}:3002/api-v1/claim/statusClaim`)   //live
  // axios.get("http://localhost:3002/api-v1/order/cronJobStatus")   // local 
});
//common routing for server
app.use("/api-v1/user", userRoutes);
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
  res.redirect("http://15.207.221.207/")
  // res.status(404).json({ code: 404, message: "Not Foundsddsd" })

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
  res.redirect("http://15.207.221.207/")


})
const PORT = 3002
httpServer.listen(PORT, () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;