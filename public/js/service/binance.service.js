angular
    .module('services')
    .service('binanceService', BinanceService);

BinanceService.$inject = ['$http', '$q', 'signingService'];

function BinanceService($http, $q, signingService) {

    var service = this;

    service.URL = 'https://binance.com/tradeDetail.html?symbol={a}_{b}';
    service.TRANSACTION_FEE = 0.05;
    service.INITIAL_INVESTMENT = 100;
    service.API = {
        KEY: '',
        SECRET: ''
    };

    var symbolsDeferred = $q.defer();
    var tickers = {};
    var priceMap = {};

    function init() {
        $http.get('https://api.binance.com/api/v1/exchangeInfo')
            .then(function(response) {
                var symbols = [];
                angular.forEach(response.data.symbols, function(symbolObj) {
                    symbols.push(symbolObj.baseAsset);
                    symbolObj.dustQty = symbolObj.filters[1].minQty;
                    tickers[symbolObj.symbol] = symbolObj;
                });
                symbols = symbols.filter(function(item, pos) {
                    return symbols.indexOf(item) === pos;
                });
                symbolsDeferred.resolve(symbols);
            })
            .catch(function(response) {
                symbolsDeferred.reject('Error fetching symbols');
                throw response;
            });
    }

    service.getSymbols = function() {
        return symbolsDeferred.promise;
    };

    service.getPriceMapLastUpdatedTime = function() {
        return priceMap.LAST_UPDATED;
    };

    service.refreshPriceMap = function() {
        return $http.get('https://api.binance.com/api/v1/ticker/allPrices')
            .then(function(response) {
                angular.forEach(response.data, function(symbolObj) {
                    priceMap[symbolObj.symbol] = symbolObj.price;
                });
                priceMap.LAST_UPDATED = new Date();
                return priceMap;
            })
            .catch(function(response) {
                throw response;
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
            a: a,
            b: b,
            c: c,
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a,
                b: b,
                c: c
            },
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

        throw 'Could not get '+ symbolTo + ' price for ' + symbolFrom;
    };

    service.relationship = function(a, b) {
        if (priceMap[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            rate: {
                market: priceMap[a + b],
                convert: priceMap[a + b]
            }
        };
        if (priceMap[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            rate: {
                market: priceMap[b + a],
                convert: ( 1 / priceMap[b + a])
            }
        };
        return null;
    };

    service.calculateDust = function(tickerName, amount) {
        var multiplier = Math.pow(10, 30);
        var dustQty = tickers[tickerName].dustQty;
        return (amount * multiplier) % (dustQty * multiplier) / multiplier;
    };

    service.generateLink = function(a, b) {
        if (priceMap[a+b]) return service.URL.replace('{a}', a).replace('{b}', b);
        else return service.URL.replace('{a}', b).replace('{b}', a);
    };


    service.performMarketOrder = function(side, quantity, symbol) {
        if (!service.API.KEY || !service.API.SECRET) throw 'Key and Secret not detected.';

        var TIME_OFFSET = 1000;

        var queryString =   'symbol='+ symbol +
                            '&side='+ side.toUpperCase() +
                            '&type='+ 'MARKET' +
                            '&quantity='+ quantity.toString() +
                            '&timestamp='+ (new Date().getTime() - TIME_OFFSET).toString();


        queryString += '&signature=' + signingService.encrypt(queryString, service.API.SECRET);


        console.log(side+'ing ' + quantity + ' ' + symbol + ' at market');

        return $http({
            method: 'POST',
            url: 'https://api.binance.com/api/v3/order/test?'+ queryString,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-MBX-APIKEY': service.API.KEY
            }
        })
            .then(function(response) {
                return response;
            })
            .catch(function(response) {
                console.error(response.data);
                return $q.reject(response.data.msg);
            });
    };



    init();

}
