angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', '$interval', 'binanceService'];

function BinanceController($scope, $interval, binanceService) {

    $scope.CONFIG = {
        DECIMALS: 8,
        BASE_SYMBOL: [],
        INVESTMENT: {
            MAX: 500
        },
        PROFIT: {
            MIN: 3.00
        }
    };

    $scope.LOADING = {
        API: false,
        ARBITRAGE: false
    };

    $scope.symbols = [];
    $scope.priceMap = {};
    $scope.timeSincePriceUpdate = null;
    $scope.results = [];

    $scope.trade = null;

    function init() {
        $scope.LOADING.API = true;
        binanceService.getSymbols()
            .then(function(symbols) {
                $scope.symbols = symbols;
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.API = false;
            });
        maintainTimeSinceLastPriceCheck();
    }

    $scope.findArbitrage = function() {
        if ($scope.symbols.length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshPriceMap()
            .then(function(priceMap) {
                $scope.priceMap = priceMap;

                var result = {};
                var results = [];
                angular.forEach($scope.symbols, function(symbol1) {
                    angular.forEach($scope.symbols, function(symbol2) {
                        angular.forEach($scope.symbols, function(symbol3) {
                            result = binanceService.relationships(symbol1, symbol2, symbol3);
                            if (!result) return;
                            if (result.percent <= 0) return;
                            results.push(result);
                        });
                    });
                });
                $scope.results = results.sort(function(a,b) {
                    if (a.percent < b.percent) return 1;
                    if (a.percent > b.percent) return -1;
                    return 0;
                });
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    $scope.setTrade = function(result) {
        $scope.trade = result;
    };

    $scope.refreshTrade = function(result) {
        binanceService.refreshPriceMap()
            .then(function() {
                return binanceService.relationships(result.symbol.a, result.symbol.b, result.symbol.c);
            })
            .then(function(newResult) {
                result = {};
                $scope.trade = newResult;
            })
            .catch(function(error) {
                throw error;
            });
    };

    function maintainTimeSinceLastPriceCheck() {
        var tick = function() {
            if (!$scope.priceMap.LAST_UPDATED) return;
            $scope.timeSincePriceUpdate = new Date() - $scope.priceMap.LAST_UPDATED;
        };
        tick();
        $interval(tick, 1000);
    }
    
    init();

}
