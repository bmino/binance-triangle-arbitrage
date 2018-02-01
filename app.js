require('dotenv').config({path: 'config/application.env'});
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
app.io = io;
var port = process.env.PORT || 3000;
server.listen(port);
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var bodyParser = require('body-parser');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon(path.join(__dirname, 'public/img', 'favicon.png')));
if (process.env.MORGAN_FORMAT !== 'none') {
	app.use(morgan(process.env.MORGAN_FORMAT || 'tiny'));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Include scripts
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));


app.use('/',								require('./routes/EjsViewController'));
app.use('/bridge/',							require('./routes/EnvironmentBridgeController'));
app.use('/binance/',						require('./routes/BinanceController'));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function(err, req, res, next) {
	console.error(err);
	res.status(err.status || 500);
	res.json(err.message);
});

// Socket Events
io.on('connection', function(socket) {
    console.log('New socket connection...');
});

module.exports = app;
