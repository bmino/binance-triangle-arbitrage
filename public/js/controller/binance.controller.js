angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', '$interval', 'binanceService'];

function BinanceController($scope, $interval, binanceService) {

    $scope.CONFIG = {
        BASE_SYMBOL: '',
        INVESTMENT: {
            MAX: 500
        },
        VOLUME: {
            MAX: 1
        },
        PROFIT: {
            MIN: 3.00
        }
    };

    $scope.LOADING = {
        API: binanceService.LOADING,
        ARBITRAGE: false
    };

    $scope.timeSincePriceUpdate = null;
    $scope.trades = [];
    $scope.currentTrade = null;

    function init() {
        maintainTimeSinceLastPriceCheck();
    }

    $scope.findArbitrage = function() {
        if (binanceService.getSymbols().length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshPriceMap()
            .then(function() {
                $scope.trades = analyzeSymbolsForArbitrage(binanceService.getSymbols())
                    .sort(sortByPercent);
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    function analyzeSymbolsForArbitrage(symbols) {
        var trades = [];
        angular.forEach(symbols, function(symbol1) {
            angular.forEach(symbols, function(symbol2) {
                angular.forEach(symbols, function(symbol3) {
                    var relationship = binanceService.relationships(symbol1, symbol2, symbol3);
                    if (!relationship || relationship.percent <= 0) return;
                    relationship.symbol = {
                        a: symbol1,
                        b: symbol2,
                        c: symbol3
                    };
                    trades.push(relationship);
                });
            });
        });
        return trades;
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    function maintainTimeSinceLastPriceCheck() {
        var tick = function() {
            var lastUpdatedTime = binanceService.getPriceMapLastUpdatedTime();
            if (!lastUpdatedTime) return;
            $scope.timeSincePriceUpdate = new Date() - lastUpdatedTime;
        };
        tick();
        $interval(tick, 1000);
    }

    function sortByPercent(a, b) {
        if (a.percent < b.percent) return 1;
        if (a.percent > b.percent) return -1;
        return 0;
    }
    
    init();

}
