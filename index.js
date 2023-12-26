require("dotenv").config()
var express = require('express');
var path = require('path');
var logger = require('morgan');
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
const dealer = require('./Dealer/dealerServer')
const price = require('./PriceBook/priceServer')
const userRoutes = require("./User/routes/user");
const dealerRoutes = require("./Dealer/routes/dealer");
const serviceRoutes = require("./Provider/routes/service");
const priceRoutes = require("./PriceBook/routes/price");
const { createProxyMiddleware } = require('http-proxy-middleware');

var app = express();



app.use("/api-v1/api-docs", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocument)(...args));
app.use("/api-v1/priceApi", swaggerUi.serve, (...args) => swaggerUi.setup(swaggerDocumentDealer)(...args));


//proxy servers
app.use('/user', createProxyMiddleware({ target: 'http://localhost:8080/', changeOrigin: true, pathRewrite: { '^/user': '/' }}));
app.use('/dealer', createProxyMiddleware({ target: 'http://localhost:8082/', changeOrigin: true, pathRewrite: { '^/dealer': '/' }}));
app.use('/price', createProxyMiddleware({ target: 'http://localhost:8083/', changeOrigin: true, pathRewrite: { '^/price': '/' }}));
app.use('/servicer', createProxyMiddleware({ target: 'http://localhost:8084/', changeOrigin: true, pathRewrite: { '^/provider': '/' }}));

app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors())
const httpServer = http.createServer(app) 
  
// view engine setup  
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('./uploads/'))

app.get('/download/:filename', (req, res) => {
  const filePath = __dirname + '/uploads/' + process.env.DUMMY_CSV_FILE;

  res.setHeader('Content-Disposition', 'attachment; filename=' + process.env.DUMMY_CSV_FILE);
  res.download(filePath, process.env.DUMMY_CSV_FILE);
});

//common routing for server
// app.use("/api-v1/user", userRoutes);
// app.use("/api-v1/admin", userRoutes);
// app.use("/api-v1/dealer", dealerRoutes);
// app.use("/api-v1/servicer", serviceRoutes);
// app.use("/api-v1/price", priceRoutes);

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

const PORT = 3002
httpServer.listen(PORT, () => console.log(`app listening at http://localhost:${PORT}`))

module.exports = app;