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
        PRICES: false,
        VOLUME: false
    };
    service.QUERIES = {
        ORDER: 0,
        REQUEST: 0
    };
    service.TIME_OFFSET = 3000;

    var symbols = [];
    var tickers = {};
    var priceMap = {};
    var volumeMap = {};

    function init() {
        service.LOADING.INITIAL = true;

        Promise.all([
            service.refreshApiCredentials(),
            service.refreshSymbolsAndTickers(),
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

    service.get24HourVolume = function(ticker) {
        return volumeMap[ticker];
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
                service.QUERIES.REQUEST += Object.keys(volumeMap).length;
                service.LOADING.VOLUME = false;
            });
    };

    service.refreshSymbolsAndTickers = function() {
        service.LOADING.TICKERS = true;
        console.log('Refreshing symbols and tickers');
        return $http.get('https://api.binance.com/api/v1/exchangeInfo')
            .then(function(response) {
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
                service.QUERIES.REQUEST++;
                service.LOADING.TICKERS = false;
            });
    };

    service.refreshPriceMap = function() {
        service.LOADING.PRICES = true;
        return $http.get('https://api.binance.com/api/v3/ticker/price')
            .then(function(response) {
                angular.forEach(response.data, function(tick) {
                    priceMap[tick.symbol] = tick.price;
                });
                priceMap.LAST_UPDATED = new Date();
                return priceMap;
            })
            .catch(andThrow)
            .finally(function() {
                service.QUERIES.REQUEST++;
                service.LOADING.PRICES = false;
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
            percent: ((ab.rate.convert * bc.rate.convert * ca.rate.convert) - 1) * 100
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
                service.QUERIES.ORDER++;
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
                service.QUERIES.REQUEST += 20;
            });
    };

    function removeDuplicates(item, pos, self) {
        return self.indexOf(item) === pos;
    }

    function andThrow(throwable) {
        throw throwable;
    }



    init();

}
