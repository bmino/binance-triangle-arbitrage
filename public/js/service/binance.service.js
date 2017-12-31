angular
    .module('services')
    .service('binanceService', BinanceService);

BinanceService.$inject = ['$http', '$q'];

function BinanceService($http, $q) {

    var service = this;

    service.URL = 'https://binance.com/tradeDetail.html?symbol={a}_{b}';
    service.TRANSACTION_FEE = 0.05;
    service.INITIAL_INVESTMENT = 100;

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

    service.refreshPriceMap = function() {
        return $http({
            type: 'GET',
            url: 'https://api.binance.com/api/v1/ticker/allPrices'
        })
            .then(function(response) {
                var prices = [];
                angular.forEach(response.data, function(symbolObj) {
                    prices[symbolObj.symbol] = symbolObj.price;
                });
                priceMap = prices;
                return prices;
            })
            .catch(function(response) {
                throw response;
            });
    };

    service.relationships = function(a, b, c, investment) {
        service.INITIAL_INVESTMENT = investment;

        var ab = service.relationship(a, b);
        if (!ab) return;

        var bc = service.relationship(b, c);
        if (!bc) return;

        var ca = service.relationship(c, a);
        if (!ca) return;

        var result = {
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a,
                b: b,
                c: c
            },
            quantity: {
                start: {
                    total: 0,
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
            }
        };

        result.quantity.start.total = service.INITIAL_INVESTMENT / convertRate(a, 'USDT');

        if (ab.method === 'Buy') {
            result.quantity.ab.total = result.quantity.start.total * convertRate(a, b);
            result.quantity.ab.dust = service.calculateDust(ab.ticker, result.quantity.ab.total);
            result.quantity.ab.market = result.quantity.ab.total - result.quantity.ab.dust;
            result.quantity.b = result.quantity.ab.market;
        } else {
            result.quantity.ab.total = result.quantity.start.total;
            result.quantity.ab.dust = service.calculateDust(ab.ticker, result.quantity.ab.total);
            result.quantity.ab.market = result.quantity.ab.total - result.quantity.ab.dust;
            result.quantity.b = result.quantity.ab.market * convertRate(a, b);
        }


        if (bc.method === 'Buy') {
            result.quantity.bc.total = result.quantity.b * convertRate(b, c);
            result.quantity.bc.dust = service.calculateDust(bc.ticker, result.quantity.bc.total);
            result.quantity.bc.market = result.quantity.bc.total - result.quantity.bc.dust;
            result.quantity.c = result.quantity.bc.market;
        } else {
            result.quantity.bc.total = result.quantity.b;
            result.quantity.bc.dust = service.calculateDust(bc.ticker, result.quantity.bc.total);
            result.quantity.bc.market = result.quantity.bc.total - result.quantity.bc.dust;
            result.quantity.c = result.quantity.bc.market * convertRate(b, c);
        }


        if (ca.method === 'Buy') {
            result.quantity.ca.total = result.quantity.c * convertRate(c, a);
            result.quantity.ca.dust = service.calculateDust(ca.ticker, result.quantity.ca.total);
            result.quantity.ca.market = result.quantity.ca.total - result.quantity.ca.dust;
            result.quantity.a = result.quantity.ca.market;
        } else {
            result.quantity.ca.total = result.quantity.c;
            result.quantity.ca.dust = service.calculateDust(ca.ticker, result.quantity.ca.total);
            result.quantity.ca.market = result.quantity.ca.total - result.quantity.ca.dust;
            result.quantity.a = result.quantity.ca.market * convertRate(c, a);
        }


        result.percent = (result.quantity.a - result.quantity.start.total) / result.quantity.start.total * 100;

        return result;
    };


    function convertRate(symbolFrom, symbolTo) {
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
    }

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
        var multiplier = 1000000;
        var dustQty = tickers[tickerName].dustQty;
        return (amount * multiplier) % (dustQty * multiplier) / multiplier;
    };

    init();

}
