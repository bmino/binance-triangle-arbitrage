var express = require('express');
var router = express.Router();
var binance = require('node-binance-api');

var UNFILLED = [];
var CHUNK_SIZE = 50;

var LIMIT = setLimitValue(100);
var MIN_THRESHOLD = 90;


router.post('/wss/depth', function(req, res, next) {
	var tickers = req.body.tickers;
	var weight = 0;

    chunks(tickers, CHUNK_SIZE).forEach(function(chunk) {
		weight += depthCache(chunk, req.app.io.sockets);
	});

    res.json(weight);
});

function depthCache(tickers, sockets) {
    console.log('Opening depth websockets for ' + tickers.length + ' tickers');

    binance.websockets.depthCache(tickers, function(symbol, depth) {
        var bids = binance.sortBids(depth.bids);
        var asks = binance.sortAsks(depth.asks);
        var askDepth = Object.keys(asks).length;
        var bidDepth = Object.keys(bids).length;
        var index = UNFILLED.indexOf(symbol);

        if (askDepth < MIN_THRESHOLD && bidDepth < MIN_THRESHOLD) {
            if (!isPresent(index)) {
                UNFILLED.push(symbol);
                console.log('Added ' + symbol + ' (' + askDepth + '/' + bidDepth + ') - ' + UNFILLED.length);
            }
        } else if (isPresent(index)) {
            UNFILLED.splice(index, 1);
            console.log('Removed ' + symbol + ' (' + askDepth + '/' + bidDepth + ') - ' + UNFILLED.length);
        }

        sockets.emit('depth:new', {
            ticker: symbol,
            unfilled: UNFILLED,
            time: new Date().getTime(),
            bid: bids,
            ask: asks,
            market: (parseFloat(binance.first(bids)) + parseFloat(binance.first(asks))) / 2
        });
    }, LIMIT);

    return weightOfLimit(LIMIT) * tickers.length;
}

function chunks(arr, len) {
    var chunks = [];
    var i = 0;

    while (i < arr.length) {
        chunks.push(arr.slice(i, i += len));
    }

    return chunks;
}

function isPresent(index) {
    return index !== -1;
}

function setLimitValue(limit) {
	var fallback = 100;
	var validValues = [1, 5, 10, 20, 50, 100, 500, 1000];
	if (validValues.indexOf(limit) === -1) {
        console.error('Invalid LIMIT value of ' + limit);
        console.error('Setting LIMIT=' + fallback);
        limit = fallback;
	}
	return limit;
}

function weightOfLimit(limit) {
	if (limit <= 100) return 1;
	if (limit === 500) return 5;
	if (limit === 500) return 10;
	console.error('Invalid LIMIT value of ' + limit);
	return 999;
}


module.exports = router;
