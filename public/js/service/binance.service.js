angular
    .module('services')
    .service('binanceService', BinanceService);

BinanceService.$inject = ['$http', 'signingService', 'bridgeService', 'socket'];

function BinanceService($http, signingService, bridgeService, socket) {

    var service = this;

    service.URL = 'https://binance.com/tradeDetail.html?symbol={a}_{b}';
    service.TRANSACTION_FEE = 0.05;
    service.API = {
        KEY: '',
        SECRET: ''
    };
    service.LOADING = {
        INITIAL: true,
        CREDENTIALS: false,
        TICKERS: false,
        SYMBOLS: false,
        RATE_LIMITS: false,
        VOLUME: false,
        LOADED_BOOKS: countMissingOrderBooks,
        UNFILLED_BOOKS: countEmptyOrderBooks
    };
    service.QUERIES = {
        ORDER: {
            HISTORY: [],
            SECOND_LIMIT: 10
        },
        REQUEST: {
            HISTORY: [],
            MINUTE_LIMIT: 1200,
            REMAINING: allowedRequestWeight
        }
    };
    service.TIME_OFFSET = 3000;
    service.UNFILLED = [];

    var symbols = [];
    var tickers = {};
    var volumeMap = {};
    var orderBookMap = {};

    function init() {
        service.LOADING.INITIAL = true;

        Promise.all([
            service.refreshApiCredentials(),
            service.refreshExchangeInfo()//,
            //service.refreshVolumeMap()
        ])
            .then(function() {
                return $http({
                    method: 'POST',
                    url: '/binance/wss/depth',
                    data: {
                        tickers: Object.keys(tickers)
                    }
                });
            })
            .then(function(response) {
                updateRequestWeight(response.data);
            })
            .catch(andThrow)
            .finally(function() {
                service.LOADING.INITIAL = false;
            });

        socket.on('depth:new', null, function(result) {
            service.UNFILLED = result.unfilled;
            delete result.UNFILLED;
            orderBookMap[result.ticker] = result;
        });
    }

    service.getSymbols = function() {
        return symbols;
    };

    service.getTickers = function() {
        return tickers;
    };

    service.getOrderBookMap = function() {
        return orderBookMap;
    };

    service.refreshApiCredentials = function() {
        service.LOADING.CREDENTIALS = true;
        return bridgeService.getApiVariables()
            .then(function(bridge) {
                service.API.KEY = bridge.BINANCE.KEY;
                service.API.SECRET = bridge.BINANCE.SECRET;
            })
            .catch(andThrow)
            .finally(function() {
                service.LOADING.CREDENTIALS = false;
            });
    };

    service.refreshVolumeMap = function() {
        service.LOADING.VOLUME = true;
        return $http.get('https://api.binance.com/api/v1/ticker/24hr')
            .then(function(response) {
                response.data.map(function(history) {
                    volumeMap[history.symbol] = parseFloat(history.volume);
                });
            })
            .catch(andThrow)
            .finally(function() {
                updateRequestWeight(Object.keys(volumeMap).length / 2);
                service.LOADING.VOLUME = false;
            });
    };

    service.refreshExchangeInfo = function() {
        service.LOADING.TICKERS = true;
        service.LOADING.SYMBOLS = true;
        service.LOADING.RATE_LIMITS = true;
        return $http.get('https://api.binance.com/api/v1/exchangeInfo')
            .then(function(response) {
                service.QUERIES.REQUEST.MINUTE_LIMIT = parseInt(response.data.rateLimits[0].limit);
                service.QUERIES.ORDER.SECOND_LIMIT = parseInt(response.data.rateLimits[1].limit);
                var duplicateSymbols = [];
                response.data.symbols.forEach(function(symbolObj) {
                    if (symbolObj.status !== 'TRADING') return;
                    duplicateSymbols.push(symbolObj.baseAsset);
                    symbolObj.dustQty = parseFloat(symbolObj.filters[1].minQty);
                    tickers[symbolObj.symbol] = symbolObj;
                });

                // Remove bogus info
                symbols = duplicateSymbols.filter(removeDuplicates);
                delete tickers["123456"];
                symbols.splice(symbols.indexOf("123456"), 1);

                console.log('Found ' + Object.keys(tickers).length + '/' + response.data.symbols.length + ' active tickers');
                console.log('Found ' + symbols.length + ' symbols');
            })
            .catch(andThrow)
            .finally(function() {
                updateRequestWeight(1);
                service.LOADING.TICKERS = false;
                service.LOADING.SYMBOLS = false;
                service.LOADING.RATE_LIMITS = false;
            });
    };

    service.performMarketOrder = function(side, quantity, symbol) {
        if (!service.API.KEY || !service.API.SECRET) return Promise.reject('Key and Secret not detected.');
        console.log(side+'ing ' + quantity + ' ' + symbol + ' at market');

        var queryString =   'symbol='+ symbol +
                            '&side='+ side.toUpperCase() +
                            '&type='+ 'MARKET' +
                            '&quantity='+ quantity.toString() +
                            '&timestamp='+ (new Date().getTime() - service.TIME_OFFSET).toString();
        queryString += '&signature=' + signingService.encrypt(queryString, service.API.SECRET);

        return $http({
            method: 'POST',
            url: 'https://api.binance.com/api/v3/order?'+ queryString,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-MBX-APIKEY': service.API.KEY
            }
        })
            .then(function(response) {
                return response.data;
            })
            .catch(function(response) {
                return Promise.reject(response.data.msg);
            })
            .finally(function() {
                updateOrderWeight(1);
            });
    };

    service.accountInformation = function() {
        if (!service.API.KEY || !service.API.SECRET) return Promise.reject('Key and Secret not detected.');

        var queryString = 'timestamp='+ (new Date().getTime() - service.TIME_OFFSET).toString();
        queryString += '&signature=' + signingService.encrypt(queryString, service.API.SECRET);

        return $http({
            method: 'GET',
            url: 'https://api.binance.com/api/v3/account?'+ queryString,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-MBX-APIKEY': service.API.KEY
            }
        })
            .then(function(response) {
                return response.data;
            })
            .catch(function(response) {
                return Promise.reject(response.data.msg);
            })
            .finally(function() {
                updateRequestWeight(5);
            });
    };

    service.generateLink = function(a, b) {
        if (tickers[a+b]) return service.URL.replace('{a}', a).replace('{b}', b);
        else return service.URL.replace('{a}', b).replace('{b}', a);
    };

    service.relationships = function(a, b, c) {
        var ab = service.relationship(a, b);
        if (!ab) return;

        var bc = service.relationship(b, c);
        if (!bc) return;

        var ca = service.relationship(c, a);
        if (!ca) return;

        return {
            id: a + b + c,
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a.toUpperCase(),
                b: b.toUpperCase(),
                c: c.toUpperCase()
            }
        };
    };

    service.relationship = function(a, b) {
        a = a.toUpperCase();
        b = b.toUpperCase();

        if (tickers[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            volume: volumeMap[a+b]
        };
        if (tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            volume: volumeMap[b+a]
        };
        return null;
    };

    service.optimizeAndCalculate = function(trade, minInvestment, maxInvestment, stepSize) {
        var quantity, calculation;
        var bestCalculation = null;

        try {
            for (quantity=minInvestment; quantity<=maxInvestment; quantity+=stepSize) {
                calculation = service.calculate(quantity, trade, orderBookMap, tickers);
                if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                    bestCalculation = calculation;
                }
            }
        } catch (e) {
            console.error(e.message);
        }

        return bestCalculation;
    };

    service.calculate = function(investmentA, trade, orderBookMap, tickers) {
        var calculated = {
            start: {
                total: investmentA,
                market: 0,
                dust: 0
            },
            ab: {
                total: 0,
                market: 0,
                dust: 0
            },
            bc: {
                total: 0,
                market: 0,
                dust: 0
            },
            ca: {
                total: 0,
                market: 0,
                dust: 0
            },
            symbol: trade.symbol,
            time: Math.min(orderBookMap[trade.ab.ticker].time, orderBookMap[trade.bc.ticker].time, orderBookMap[trade.ca.ticker].time),
            a: 0,
            b: 0,
            c: 0
        };

        if (trade.ab.method === 'Buy') {
            calculated.ab.total = orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
            calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, tickers);
            calculated.b = calculated.ab.market;
            calculated.start.market = orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
        } else {
            calculated.ab.total = calculated.start.total;
            calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, tickers);
            calculated.b = orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
            calculated.start.market = calculated.ab.market;
        }
        calculated.ab.dust = 0;
        calculated.ab.volume = calculated.ab.market / (trade.ab.volume / 24);


        if (trade.bc.method === 'Buy') {
            calculated.bc.total = orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker, orderBookMap[trade.bc.ticker]);
            calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, tickers);
            calculated.c = calculated.bc.market;
        } else {
            calculated.bc.total = calculated.b;
            calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, tickers);
            calculated.c = orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, trade.bc.ticker, orderBookMap[trade.bc.ticker]);
        }
        calculated.bc.dust = calculated.bc.total - calculated.bc.market;
        calculated.bc.volume = calculated.bc.market / (trade.bc.volume / 24);


        if (trade.ca.method === 'Buy') {
            calculated.ca.total = orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker, orderBookMap[trade.ca.ticker]);
            calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, tickers);
            calculated.a = calculated.ca.market;
        } else {
            calculated.ca.total = calculated.c;
            calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, tickers);
            calculated.a = orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, trade.ca.ticker, orderBookMap[trade.ca.ticker]);
        }
        calculated.ca.dust = calculated.ca.total - calculated.ca.market;
        calculated.ca.volume = calculated.ca.market / (trade.ca.volume / 24);

        calculated.volume = Math.max(calculated.ab.volume, calculated.bc.volume, calculated.ca.volume) * 100;

        calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
        if (!calculated.percent) calculated.percent = 0;

        return calculated;
    };

    function orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, orderBook) {
        var i,j;
        var amountTo = 0;
        var rates, rate, quantity, exchangeableAmount;

        if (amountFrom === 0) return 0;

        if (ticker === symbolFrom + symbolTo) {
            rates = Object.keys(orderBook.bid);
            if (rates.length === 0) {
                throw new Error('No bids available to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo);
            }
            for (i=0; i<rates.length; i++) {
                rate = parseFloat(rates[i]);
                quantity = parseFloat(orderBook.bid[rates[i]]);
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += quantity * rate;
                } else {
                    // Last fill
                    amountTo += amountFrom * rate;
                    amountFrom = 0;
                    return amountTo;
                }
            }
        } else {
            rates = Object.keys(orderBook.ask);
            if (rates.length === 0) {
                throw new Error('No asks available to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo);
            }
            for (j=0; j<rates.length; j++) {
                rate = parseFloat(rates[j]);
                quantity = parseFloat(orderBook.ask[rates[j]]);
                exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= quantity * rate;
                    amountTo += quantity;
                } else {
                    // Last fill
                    amountTo += amountFrom / rate;
                    amountFrom = 0;
                    return amountTo;
                }
            }
        }
        console.error('Depth (' + rates.length + ') too shallow to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo + ' using ' + ticker);
        console.error('Went through depths:', rates);
        return amountTo;
    }

    function calculateDustless(tickerName, amount, tickers) {
        var amountString = amount.toString();
        var dustQty = tickers[tickerName].dustQty;
        var decimals = dustQty === 1 ? 0 : dustQty.toString().indexOf('1') - 1;
        var decimalIndex = amountString.indexOf('.');
        if (decimalIndex === -1) {
            // Integer
            return amount;
        } else {
            // Float
            return parseFloat(amountString.slice(0, decimalIndex + decimals + 1));
        }
    }

    function countMissingOrderBooks() {
        return Object.keys(tickers).length - Object.keys(orderBookMap).length;
    }

    function countEmptyOrderBooks() {
        return service.UNFILLED.length;
    }

    function allowedRequestWeight() {
        var now = new Date();
        var oneMinutePrior = now.setMinutes(now.getMinutes() - 1);
        var expended = service.QUERIES.REQUEST.HISTORY.map(function(request) {
            return request.time >= oneMinutePrior ? request.weight : 0;
        }).reduce(add, 0);
        return service.QUERIES.REQUEST.MINUTE_LIMIT - expended;
    }

    function add(a,b) {
        return a + b;
    }

    function updateRequestWeight(weight) {
        weight = Math.ceil(weight);
        service.QUERIES.REQUEST.HISTORY.push({
            time: new Date(),
            weight: weight
        });
    }

    function updateOrderWeight(weight) {
        weight = Math.ceil(weight);
        service.QUERIES.ORDER.HISTORY.push({
            time: new Date(),
            weight: weight
        });
    }

    function removeDuplicates(item, pos, self) {
        return self.indexOf(item) === pos;
    }

    function andThrow(throwable) {
        throw throwable;
    }



    init();

}
