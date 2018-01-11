angular
    .module('directives')
    .directive('tradeDetails', Trade);

Trade.$inject = ['binanceService'];

function Trade(binanceService) {

    var directive = {
        restrict: 'E',
        templateUrl: '/html/trade-details.html',
        scope: {
            trade: '=',
            maxInvestment: '=',
            minProfit: '='
        },
        link: link
    };

    function link(scope, element, attrs) {

        scope.calculated = {
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
        };

        function init() {
            scope.investment = 100;
            scope.$watch('trade.id', function() {
                scope.executionTime = null;
                updateVolumes();
                scope.optimize();
            });
        }


        scope.calculate = function(investment) {

            scope.calculated.start.total = investment / binanceService.convertRate(scope.trade.symbol.a, 'USDT');

            if (scope.trade.ab.method === 'Buy') {
                scope.calculated.ab.total = scope.calculated.start.total * binanceService.convertRate(scope.trade.symbol.a, scope.trade.symbol.b);
                scope.calculated.ab.market = binanceService.calculateDustless(scope.trade.ab.ticker, scope.calculated.ab.total);
                scope.calculated.ab.dust = scope.calculated.ab.total - scope.calculated.ab.market;

                scope.calculated.start.market = scope.calculated.ab.market * binanceService.convertRate(scope.trade.symbol.b, scope.trade.symbol.a);
                scope.calculated.ab.dust = 0;

                scope.calculated.b = scope.calculated.ab.market;
            } else {
                scope.calculated.ab.total = scope.calculated.start.total;
                scope.calculated.ab.market = binanceService.calculateDustless(scope.trade.ab.ticker, scope.calculated.ab.total);
                scope.calculated.ab.dust = scope.calculated.ab.total - scope.calculated.ab.market;

                scope.calculated.start.market = scope.calculated.ab.market;
                scope.calculated.ab.dust = 0;

                scope.calculated.b = scope.calculated.ab.market * binanceService.convertRate(scope.trade.symbol.a, scope.trade.symbol.b);
            }


            if (scope.trade.bc.method === 'Buy') {
                scope.calculated.bc.total = scope.calculated.b * binanceService.convertRate(scope.trade.symbol.b, scope.trade.symbol.c);
                scope.calculated.bc.market = binanceService.calculateDustless(scope.trade.bc.ticker, scope.calculated.bc.total);
                scope.calculated.bc.dust = scope.calculated.bc.total - scope.calculated.bc.market;
                scope.calculated.c = scope.calculated.bc.market;
            } else {
                scope.calculated.bc.total = scope.calculated.b;
                scope.calculated.bc.market = binanceService.calculateDustless(scope.trade.bc.ticker, scope.calculated.bc.total);
                scope.calculated.bc.dust = scope.calculated.bc.total - scope.calculated.bc.market;
                scope.calculated.c = scope.calculated.bc.market * binanceService.convertRate(scope.trade.symbol.b, scope.trade.symbol.c);
            }


            if (scope.trade.ca.method === 'Buy') {
                scope.calculated.ca.total = scope.calculated.c * binanceService.convertRate(scope.trade.symbol.c, scope.trade.symbol.a);
                scope.calculated.ca.market = binanceService.calculateDustless(scope.trade.ca.ticker, scope.calculated.ca.total);
                scope.calculated.ca.dust = scope.calculated.ca.total - scope.calculated.ca.market;
                scope.calculated.a = scope.calculated.ca.market;
            } else {
                scope.calculated.ca.total = scope.calculated.c;
                scope.calculated.ca.market = binanceService.calculateDustless(scope.trade.ca.ticker, scope.calculated.ca.total);
                scope.calculated.ca.dust = scope.calculated.ca.total - scope.calculated.ca.market;
                scope.calculated.a = scope.calculated.ca.market * binanceService.convertRate(scope.trade.symbol.c, scope.trade.symbol.a);
            }

            scope.percent = (scope.calculated.a - scope.calculated.start.total) / scope.calculated.start.total * 100;
            if (!scope.percent) scope.percent = 0;

            return scope.percent;
        };

        scope.refresh = function() {
            return binanceService.refreshPriceMap()
                .then(function() {
                    var rel = binanceService.relationships(scope.trade.symbol.a, scope.trade.symbol.b, scope.trade.symbol.c);
                    angular.extend(scope.trade, rel);
                    updateVolumes();
                    scope.optimize();
                })
                .catch(console.error)
                .finally(function() {
                    console.log('Done refreshing');
                });
        };

        function updateVolumes() {
            Promise.all([
                binanceService.getHourlyVolume(scope.trade.ab.ticker),
                binanceService.getHourlyVolume(scope.trade.bc.ticker),
                binanceService.getHourlyVolume(scope.trade.ca.ticker)
            ])
                .then(function(volumes) {
                    scope.trade.ab.volume = volumes[0];
                    scope.trade.bc.volume = volumes[1];
                    scope.trade.ca.volume = volumes[2];
                })
                .catch(console.error);
        }

        scope.execute = function() {
            var startTime = null;
            scope.executionTime = null;
            scope.refresh()
                .then(function() {
                    startTime = new Date();
                    if (scope.percent < scope.minProfit) throw scope.percent + ' is too low to execute trade.';
                    return binanceService.performMarketOrder(scope.trade.ab.method.toUpperCase(), scope.calculated.ab.market, scope.trade.ab.ticker)
                        .then(function(response) {
                            return binanceService.performMarketOrder(scope.trade.bc.method.toUpperCase(), scope.calculated.bc.market, scope.trade.bc.ticker);
                        })
                        .then(function(response) {
                            return binanceService.performMarketOrder(scope.trade.ca.method.toUpperCase(), scope.calculated.ca.market, scope.trade.ca.ticker);
                        });
                })
                .then(function() {
                    console.log('DONE!');
                })
                .catch(console.error)
                .finally(function() {
                    scope.executionTime = new Date() - startTime;
                });
        };

        scope.generateLink = function(a, b) {
            return binanceService.generateLink(a, b);
        };

        scope.apiKeyPresent = function() {
            return binanceService.API.KEY && binanceService.API.SECRET;
        };

        scope.optimize = function() {
            var best = {
                investment: 0,
                percent: -100
            };
            for (var dollars=1; dollars<scope.maxInvestment; dollars++) {
                var percent = scope.calculate(dollars);
                if (percent > best.percent) {
                    best.investment = dollars;
                    best.percent = percent;
                }
            }
            scope.investment = best.investment;
        };

        init();

    }

    return directive;

}
