angular
    .module('services')
    .service('binanceService', BinanceService);

BinanceService.$inject = ['$http', '$q', 'signingService', 'bridgeService'];

function BinanceService($http, $q, signingService, bridgeService) {

    var service = this;

    service.URL = 'https://binance.com/tradeDetail.html?symbol={a}_{b}';
    service.TRANSACTION_FEE = 0.05;
    service.INITIAL_INVESTMENT = 100;
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
        PRICES: false,
        VOLUME: false,
        BOOKS: false
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

    var symbols = [];
    var tickers = {};
    var priceMap = {};
    var volumeMap = {};
    var orderBookMap = {};

    function init() {
        service.LOADING.INITIAL = true;

        Promise.all([
            service.refreshApiCredentials(),
            service.refreshExchangeInfo(),
            service.refreshPriceMap(),
            service.refreshVolumeMap()
        ])
            .catch(andThrow)
            .finally(function() {
                service.LOADING.INITIAL = false;
            });
    }

    service.getSymbols = function() {
        return symbols;
    };

    service.getPriceMapLastUpdatedTime = function() {
        return priceMap.LAST_UPDATED;
    };

    service.refreshApiCredentials = function() {
        service.LOADING.CREDENTIALS = true;
        console.log('Refreshing api credentials');
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
        console.log('Refreshing volume map');
        return $http.get('https://api.binance.com/api/v1/ticker/24hr')
            .then(function(response) {
                console.log('Refreshed 24hr history for ' + response.data.length + ' tickers');
                response.data.map(function(history) {
                    volumeMap[history.symbol] = parseFloat(history.volume);
                });
            })
            .catch(andThrow)
            .finally(function() {
                updateRequestWeight(Object.keys(volumeMap).length);
                service.LOADING.VOLUME = false;
            });
    };

    service.refreshExchangeInfo = function() {
        service.LOADING.TICKERS = true;
        service.LOADING.SYMBOLS = true;
        service.LOADING.RATE_LIMITS = true;
        console.log('Refreshing symbols and tickers');
        return $http.get('https://api.binance.com/api/v1/exchangeInfo')
            .then(function(response) {
                service.QUERIES.REQUEST.MINUTE_LIMIT = parseInt(response.data.rateLimits[0].limit);
                service.QUERIES.ORDER.SECOND_LIMIT = parseInt(response.data.rateLimits[1].limit);
                var duplicateSymbols = [];
                response.data.symbols.map(function(symbolObj) {
                    duplicateSymbols.push(symbolObj.baseAsset);
                    symbolObj.dustQty = parseFloat(symbolObj.filters[1].minQty);
                    tickers[symbolObj.symbol] = symbolObj;
                });
                symbols = duplicateSymbols.filter(removeDuplicates);
            })
            .catch(andThrow)
            .finally(function() {
                updateRequestWeight(1);
                service.LOADING.TICKERS = false;
                service.LOADING.SYMBOLS = false;
                service.LOADING.RATE_LIMITS = false;
            });
    };

    service.refreshPriceMap = function() {
        service.LOADING.PRICES = true;
        return $http.get('https://api.binance.com/api/v3/ticker/price')
            .then(function(response) {
                response.data.forEach(function(tick) {
                    priceMap[tick.symbol] = parseFloat(tick.price);
                });
                priceMap.LAST_UPDATED = new Date();
                return priceMap;
            })
            .catch(andThrow)
            .finally(function() {
                updateRequestWeight(1);
                service.LOADING.PRICES = false;
            });
    };

    service.refreshAllOrderBooks = function() {
        service.LOADING.BOOKS = true;
        var promises = [];
        Object.keys(tickers).forEach(function(ticker) {
            promises.push(service.refreshOrderBook(ticker));
        });
        return Promise.all(promises)
            .catch(console.error)
            .finally(function() {
                service.LOADING.BOOKS = false;
            });
    };

    service.refreshOrderBook = function(ticker) {
        if (!service.API.KEY || !service.API.SECRET) throw 'Key and Secret not detected.';

        return $http.get('https://api.binance.com/api/v1/depth?limit=100&symbol='+ ticker)
            .then(function(response) {
                return orderBookMap[ticker] = {
                    updated: new Date(),
                    bids: response.data.bids,
                    asks: response.data.asks
                };
            })
            .catch(function(response) {
                console.error(response.data);
                return $q.reject(response.data.msg);
            })
            .finally(function() {
                updateRequestWeight(1);
            });
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
            found: service.getPriceMapLastUpdatedTime(),
            ab: ab,
            bc: bc,
            ca: ca,
            percent: ((ab.rate.convert * bc.rate.convert * ca.rate.convert) - 1) * 100,
            symbol: {
                a: a,
                b: b,
                c: c
            }
        };
    };


    service.convertRate = function(symbolFrom, symbolTo) {
        var direct = service.relationship(symbolFrom, symbolTo);
        if (direct) return direct.rate.convert;

        var mediums = ['BTC', 'ETH', 'BNB'];
        for (var i=0; i<mediums.length; i++) {
            var medium = mediums[i];
            var am = service.relationship(symbolFrom, medium);
            var mb = service.relationship(medium, symbolTo);
            if (am && mb) {
                return am.rate.convert * mb.rate.convert;
            }
        }

        console.error('Could not get '+ symbolTo + ' price for ' + symbolFrom);
        return NaN;
    };

    service.orderBookConversion = function(amountFrom, symbolFrom, symbolTo, orderBook) {
        var amountTo = 0;
        var rate, quantity;

        if (priceMap[symbolFrom + symbolTo]) {
            for (var i=0; i<orderBook.bids.length; i++) {
                rate = parseFloat(orderBook.bids[i][0]);
                quantity = parseFloat(orderBook.bids[i][1]);
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += quantity * rate;
                } else {
                    // Last fill
                    amountTo += amountFrom * rate;
                    amountFrom = 0;
                    //console.log('Converted ' + amountFrom.toFixed(3) + ' ' + symbolFrom + ' exactly to ' + amountTo + ' ' + symbolTo);
                    return amountTo;
                }
            }
        } else {
            for (var j=0; j<orderBook.asks.length; j++) {
                rate = parseFloat(orderBook.asks[j][0]);
                quantity = parseFloat(orderBook.asks[j][1]);
                var exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= quantity * rate;
                    amountTo += quantity;
                } else {
                    // Last fill
                    amountTo += amountFrom / rate;
                    amountFrom = 0;
                    //console.log('Converted ' + amountFrom.toFixed(3) + ' ' + symbolFrom + ' exactly to ' + amountTo + ' ' + symbolTo);
                    return amountTo;
                }
            }
        }

        throw 'Could not fill order with given order book depth';
    };

    service.relationship = function(a, b) {
        if (priceMap[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            volume: volumeMap[a+b],
            rate: {
                market: priceMap[a + b],
                convert: priceMap[a + b]
            }
        };
        if (priceMap[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            volume: volumeMap[b+a],
            rate: {
                market: priceMap[b + a],
                convert: ( 1 / priceMap[b + a])
            }
        };
        return null;
    };

    service.calculateDustless = function(tickerName, amount) {
        var dustQty = tickers[tickerName].dustQty;
        var decimals = dustQty === 1 ? 0 : dustQty.toString().indexOf('1') - 1;
        var decimalIndex = amount.toString().indexOf('.');
        if (decimalIndex === -1) {
            // Integer
            return amount;
        } else {
            // Float
            return parseFloat(amount.toString().slice(0, decimalIndex + decimals + 1));
        }
    };

    service.generateLink = function(a, b) {
        if (priceMap[a+b]) return service.URL.replace('{a}', a).replace('{b}', b);
        else return service.URL.replace('{a}', b).replace('{b}', a);
    };


    service.performMarketOrder = function(side, quantity, symbol) {
        if (!service.API.KEY || !service.API.SECRET) throw 'Key and Secret not detected.';

        var queryString =   'symbol='+ symbol +
                            '&side='+ side.toUpperCase() +
                            '&type='+ 'MARKET' +
                            '&quantity='+ quantity.toString() +
                            '&timestamp='+ (new Date().getTime() - service.TIME_OFFSET).toString();


        queryString += '&signature=' + signingService.encrypt(queryString, service.API.SECRET);


        console.log(side+'ing ' + quantity + ' ' + symbol + ' at market');

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
                console.error(response.data);
                return $q.reject(response.data.msg);
            })
            .finally(function() {
                updateOrderWeight(1);
            });
    };

    service.accountInformation = function() {
        if (!service.API.KEY || !service.API.SECRET) throw 'Key and Secret not detected.';

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
                console.error(response.data);
                return $q.reject(response.data.msg);
            })
            .finally(function() {
                updateRequestWeight(20);
            });
    };

    service.calculate = function(investmentUSDT, trade) {

        var calculated = {
            start: {
                initialUSDT: investmentUSDT,
                total: investmentUSDT * service.convertRate('USDT', trade.symbol.a),
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
            a: 0,
            b: 0,
            c: 0
        };

        if (trade.ab.method === 'Buy') {
            calculated.ab.total = service.orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, orderBookMap[trade.ab.ticker]);
            calculated.ab.market = service.calculateDustless(trade.ab.ticker, calculated.ab.total);
            calculated.b = calculated.ab.market;
            calculated.start.market = service.orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, orderBookMap[trade.ab.ticker]);
        } else {
            calculated.ab.total = calculated.start.total;
            calculated.ab.market = service.calculateDustless(trade.ab.ticker, calculated.ab.total);
            calculated.b = service.orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, orderBookMap[trade.ab.ticker]);
            calculated.start.market = calculated.ab.market;
        }
        calculated.ab.dust = 0;
        calculated.ab.volume = calculated.ab.market / (trade.ab.volume / 24);


        if (trade.bc.method === 'Buy') {
            calculated.bc.total = service.orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, orderBookMap[trade.bc.ticker]);
            calculated.bc.market = service.calculateDustless(trade.bc.ticker, calculated.bc.total);
            calculated.c = calculated.bc.market;
        } else {
            calculated.bc.total = calculated.b;
            calculated.bc.market = service.calculateDustless(trade.bc.ticker, calculated.bc.total);
            calculated.c = service.orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, orderBookMap[trade.bc.ticker]);
        }
        calculated.bc.dust = calculated.bc.total - calculated.bc.market;
        calculated.bc.volume = calculated.bc.market / (trade.bc.volume / 24);


        if (trade.ca.method === 'Buy') {
            calculated.ca.total = service.orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, orderBookMap[trade.ca.ticker]);
            calculated.ca.market = service.calculateDustless(trade.ca.ticker, calculated.ca.total);
            calculated.a = calculated.ca.market;
        } else {
            calculated.ca.total = calculated.c;
            calculated.ca.market = service.calculateDustless(trade.ca.ticker, calculated.ca.total);
            calculated.a = service.orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, orderBookMap[trade.ca.ticker]);
        }
        calculated.ca.dust = calculated.ca.total - calculated.ca.market;
        calculated.ca.volume = calculated.ca.market / (trade.ca.volume / 24);

        calculated.volume = Math.max(calculated.ab.volume, calculated.bc.volume, calculated.ca.volume) * 100;

        calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
        if (!calculated.percent) calculated.percent = 0;

        return calculated;
    };

    service.optimizeAndCalculate = function(trade, maxInvestment) {
        var bestCalculation = null;
        for (var dollars=1; dollars<maxInvestment; dollars++) {
            var calculation = service.calculate(dollars, trade);
            if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                bestCalculation = calculation;
            }
        }
        return bestCalculation;
    };

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
        service.QUERIES.REQUEST.HISTORY.push({
            time: new Date(),
            weight: weight
        });
    }

    function updateOrderWeight(weight) {
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
