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

    service.analyze = function(minInvestment, maxInvestment, stepSize, baseSymbol) {
        var relationship, tradePromise;
        var tradePromises = [];

        var worker = new Worker('/js/worker/optimizeAndCalculate.js');
        worker.postMessage({
            tickers: tickers
        });

        symbols.forEach(function(symbol2) {
            symbols.forEach(function(symbol3) {
                relationship = relationships(baseSymbol, symbol2, symbol3);
                if (relationship) {
                    tradePromise = service.optimizeAndCalculate(relationship, minInvestment, maxInvestment, stepSize, worker);
                    tradePromises.push(tradePromise);
                }
            });
        });

        return Promise.all(tradePromises)
            .finally(function() {
                worker.terminate();
            });
    };

    service.optimizeAndCalculate = function(relationship, minInvestment, maxInvestment, stepSize, worker) {
        return new Promise(function(resolve, reject) {
            worker.addEventListener('message', function(event) {
                if (event.data.id !== relationship.id) return;
                return resolve(event.data);
            });
            worker.addEventListener('error', function(event) {
                if (event.data.id !== relationship.id) return;
                console.error('Found error from worker for ' + relationship.id);
                console.error('Line: ' + event.lineno);
                return reject(event.message);
            });

            var smallOrderBook = {};
            smallOrderBook[relationship.ab.ticker] = orderBookMap[relationship.ab.ticker];
            smallOrderBook[relationship.bc.ticker] = orderBookMap[relationship.bc.ticker];
            smallOrderBook[relationship.ca.ticker] = orderBookMap[relationship.ca.ticker];

            worker.postMessage({
                relationship: relationship,
                minInvestment: minInvestment,
                maxInvestment: maxInvestment,
                stepSize: stepSize,
                orderBookMap: smallOrderBook
            });
        });
    };


    function relationships(a, b, c) {
        var ab = relationship(a, b);
        if (!ab) return;

        var bc = relationship(b, c);
        if (!bc) return;

        var ca = relationship(c, a);
        if (!ca) return;

        return {
            id: a + b + c + '-' + new Date().getTime(),
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a.toUpperCase(),
                b: b.toUpperCase(),
                c: c.toUpperCase()
            }
        };
    }

    function relationship(a, b) {
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
